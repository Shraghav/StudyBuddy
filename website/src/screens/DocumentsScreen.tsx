import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  useTheme
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { documentApi } from '../services/api';
import { uploadFileToSupabaseStorage } from '../services/supabase';
import { DocumentItem } from '../types';
import { PdfViewerModal } from '../components/PdfViewerModal';

// Helper to normalize any case variation of backend status safely
export const normalizeDocumentStatus = (status?: string): 'READY' | 'Processing' | 'FAILED' => {
  const s = (status || '').trim().toUpperCase();
  if (s === 'READY') return 'READY';
  if (s === 'FAILED') return 'FAILED';
  return 'Processing';
};

export const DocumentsScreen: React.FC = () => {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Deletion loader states
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  // Multi-select
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Rename Dialog State
  const [renameTarget, setRenameTarget] = useState<DocumentItem | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // PDF Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  /**
   * Fetches documents and filters to ONLY display documents whose backend status is READY.
   * No repeated polling.
   */
  const fetchDocuments = async () => {
    try {
      const data = await documentApi.getAll();
      // Only display documents if status is READY from backend
      const readyDocs = (data || []).filter(
        (d) => normalizeDocumentStatus(d.status) === 'READY'
      );
      setDocuments(readyDocs);
      return readyDocs;
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      return [];
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDocuments().finally(() => setLoading(false));
  }, []);

  /**
   * Handles document upload with strict sequential locking.
   * Until this upload & backend registration completes, no other uploads are permitted.
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    setErrorBanner(null);
    setUploading(true);

    try {
      // Step 1: Upload binary directly to Supabase Storage 'study-buddy-docs'
      const { publicUrl } = await uploadFileToSupabaseStorage(file);

      // Step 2: Register in backend API with storage URL
      const uploadedDoc = await documentApi.upload(file.name, publicUrl);

      // Step 2b: Wait for backend OCR and embedding background processing to complete
      let attempts = 0;
      while (attempts < 20) {
        await new Promise((r) => setTimeout(r, 1500));
        const allDocs = await documentApi.getAll();
        const match = allDocs.find((d) => (uploadedDoc && d.id === uploadedDoc.id) || d.name === file.name);
        if (match && normalizeDocumentStatus(match.status) === 'READY') {
          break;
        } else if (match && normalizeDocumentStatus(match.status) === 'FAILED') {
          throw new Error('Document processing failed in backend OCR.');
        }
        attempts++;
      }

      // Step 3: Refresh documents from backend
      await fetchDocuments();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map((d) => d.id));
    }
  };

  const handleSingleDelete = async (docId: string) => {
    if (deletingDocId || batchDeleting) return;
    try {
      setDeletingDocId(docId);
      await documentApi.batchDelete([docId]);
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      await fetchDocuments();
    } catch (err: any) {
      setErrorBanner('Failed to delete document.');
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedDocIds.length === 0 || batchDeleting) return;
    try {
      setBatchDeleting(true);
      await documentApi.batchDelete(selectedDocIds);
      setSelectedDocIds([]);
      await fetchDocuments();
    } catch (err: any) {
      setErrorBanner('Failed to delete selected documents.');
    } finally {
      setBatchDeleting(false);
    }
  };

  const handleConfirmRename = async () => {
    if (!renameTarget || !renameInput.trim() || renaming) return;
    try {
      setRenaming(true);
      await documentApi.rename(renameTarget.id, renameInput.trim());
      setRenameTarget(null);
      await fetchDocuments();
    } catch (err: any) {
      setErrorBanner('Failed to rename document.');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <Box sx={{ p: 4, height: '100vh', overflowY: 'auto', bgcolor: theme.palette.background.default }}>
      {/* Top Banner & Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
            Document Knowledge Hub
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            Upload PDFs & notes for AI grounded chat and quiz generation.
          </Typography>
        </Box>

        {/* Upload Button */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <input
            type="file"
            accept=".pdf,.txt"
            ref={fileInputRef}
            disabled={uploading}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          <Button
            variant="outlined"
            onClick={() => {
              setLoading(true);
              fetchDocuments().finally(() => setLoading(false));
            }}
            disabled={uploading || loading}
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            sx={{ borderRadius: 2 }}
          >
            Refresh
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            sx={{ px: 2.5, py: 1, borderRadius: 2, fontWeight: 700 }}
          >
            {uploading ? 'Uploading & Processing...' : 'Upload Document'}
          </Button>
        </Box>
      </Box>

      {/* Uploading Status Banner */}
      {uploading && (
        <Alert
          severity="info"
          icon={<CircularProgress size={20} color="inherit" />}
          sx={{ mb: 3, borderRadius: 2, alignItems: 'center' }}
        >
          Uploading and processing your document. Please wait until processing completes before uploading another file.
        </Alert>
      )}

      {errorBanner && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setErrorBanner(null)}>
          {errorBanner}
        </Alert>
      )}

      {/* Multi-Select Floating Actions */}
      {selectedDocIds.length > 0 && (
        <Paper
          sx={{
            p: 1.5,
            px: 2.5,
            mb: 2.5,
            borderRadius: 2.5,
            bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#ede9fe',
            border: `1px solid ${theme.palette.primary.main}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
            {selectedDocIds.length} document{selectedDocIds.length > 1 ? 's' : ''} selected
          </Typography>
          <Button
            variant="contained"
            color="error"
            size="small"
            disabled={batchDeleting || Boolean(deletingDocId)}
            startIcon={batchDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
            onClick={handleBatchDelete}
            sx={{ fontWeight: 700 }}
          >
            {batchDeleting ? 'Deleting...' : 'Delete Selected'}
          </Button>
        </Paper>
      )}

      {/* Documents Table */}
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: 'none',
          bgcolor: theme.palette.background.paper
        }}
      >
        <Table>
          <TableHead sx={{ bgcolor: theme.palette.mode === 'dark' ? '#1f2937' : '#f8fafc' }}>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={documents.length > 0 && selectedDocIds.length === documents.length}
                  indeterminate={selectedDocIds.length > 0 && selectedDocIds.length < documents.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Document Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Uploaded</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                    Loading documents...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <PictureAsPdfIcon sx={{ fontSize: 48, color: theme.palette.text.secondary, mb: 1, opacity: 0.5 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    No ready documents available
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Click "Upload Document" to ingest your study material.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                const isThisDeleting = deletingDocId === doc.id;

                return (
                  <TableRow key={doc.id} hover selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(doc.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <PictureAsPdfIcon color="error" fontSize="small" />
                        <Typography variant="body2" fontWeight={600} sx={{ color: theme.palette.text.primary }}>
                          {doc.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary, fontSize: '0.85rem' }}>
                      {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : 'Just now'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label="READY"
                        size="small"
                        color="success"
                        variant="filled"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {/* View Document Button: Enabled for READY status */}
                      <Tooltip title="View Document">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setPreviewDoc(doc)}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      {/* Rename Button */}
                      <Tooltip title="Rename Document">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setRenameTarget(doc);
                            setRenameInput(doc.name);
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {/* Delete Button with inline Loader */}
                      <Tooltip title={isThisDeleting ? 'Deleting...' : 'Delete Document'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={isThisDeleting || batchDeleting}
                            onClick={() => handleSingleDelete(doc.id)}
                          >
                            {isThisDeleting ? (
                              <CircularProgress size={16} color="error" />
                            ) : (
                              <DeleteOutlineIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Centered PDF Viewer Modal */}
      <PdfViewerModal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        documentTitle={previewDoc?.name || ''}
        fileUrl={previewDoc?.file_url || null}
      />

      {/* Rename Dialog */}
      <Dialog open={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Rename Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Document Name"
            fullWidth
            variant="outlined"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)} disabled={renaming}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmRename}
            disabled={!renameInput.trim() || renaming}
            startIcon={renaming ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {renaming ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
