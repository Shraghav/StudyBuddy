import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Button,
  useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface PdfViewerModalProps {
  open: boolean;
  onClose: () => void;
  documentTitle: string;
  fileUrl: string | null;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  open,
  onClose,
  documentTitle,
  fileUrl
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '88vh',
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: theme.palette.background.paper
        }
      }}
    >
      <DialogTitle
        sx={{
          py: 1.5,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
          <PictureAsPdfIcon color="error" />
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ maxWidth: 500 }}>
            {documentTitle || 'Document Viewer'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {fileUrl && (
            <IconButton
              size="small"
              component="a"
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, flex: 1, bgcolor: '#525659', display: 'flex', flexDirection: 'column' }}>
        {fileUrl ? (
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=0`}
            title={documentTitle}
            width="100%"
            height="100%"
            style={{ border: 'none', flex: 1 }}
          />
        ) : (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: '#fff' }}>
            <CircularProgress color="inherit" />
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Loading document file...
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

