import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  Chip,
  Tooltip,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CloseIcon from '@mui/icons-material/Close';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { ChatSessionItem, QuizSessionSummary, NavTab } from '../types';

interface TertiaryHistoryBarProps {
  activeTab: NavTab;
  onClose: () => void;
  // Chat History
  chatSessions: ChatSessionItem[];
  selectedChatId: string | null;
  onSelectChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => Promise<void>;
  onDeleteChats: (ids: string[]) => Promise<void>;
  // Quiz History
  quizSessions: QuizSessionSummary[];
  selectedQuizId: string | null;
  onSelectQuiz: (id: string) => void;
  onRenameQuiz: (id: string, newTitle: string) => Promise<void>;
  onDeleteQuizzes: (ids: string[]) => Promise<void>;
}

export const TertiaryHistoryBar: React.FC<TertiaryHistoryBarProps> = ({
  activeTab,
  onClose,
  chatSessions,
  selectedChatId,
  onSelectChat,
  onRenameChat,
  onDeleteChats,
  quizSessions,
  selectedQuizId,
  onSelectQuiz,
  onRenameQuiz,
  onDeleteQuizzes
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  // Rename Dialog State
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [newTitle, setNewTitle] = useState('');

  // Handle Multi-Select Checkbox
  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (items: { id: string }[]) => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0 || isBatchDeleting) return;
    try {
      setIsBatchDeleting(true);
      if (activeTab === 'chat') {
        await onDeleteChats(selectedIds);
      } else {
        await onDeleteQuizzes(selectedIds);
      }
      setSelectedIds([]);
      setIsMultiSelect(false);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleOpenRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameTarget({ id, title: currentTitle });
    setNewTitle(currentTitle);
  };

  const handleConfirmRename = async () => {
    if (!renameTarget || !newTitle.trim() || renaming) return;
    try {
      setRenaming(true);
      if (activeTab === 'chat') {
        await onRenameChat(renameTarget.id, newTitle.trim());
      } else {
        await onRenameQuiz(renameTarget.id, newTitle.trim());
      }
      setRenameTarget(null);
    } finally {
      setRenaming(false);
    }
  };

  // Filter items based on search query
  const filteredChats = chatSessions.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuizzes = quizSessions.filter((q) =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box
      sx={{
        width: 235,
        height: '100vh',
        bgcolor: theme.palette.mode === 'dark' ? '#141d2e' : '#f8fafc',
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 5,
        flexShrink: 0
      }}
    >
      {/* Top Header */}
      <Box sx={{ p: 1.5, pb: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: theme.palette.text.primary }}>
            {activeTab === 'chat' ? 'Chat History' : 'Quiz History'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.2 }}>
            <Tooltip title={isMultiSelect ? 'Cancel' : 'Select Multiple'}>
              <IconButton
                size="small"
                onClick={() => {
                  setIsMultiSelect(!isMultiSelect);
                  setSelectedIds([]);
                }}
                color={isMultiSelect ? 'primary' : 'default'}
                sx={{ p: 0.4 }}
              >
                {isMultiSelect ? <CheckBoxIcon sx={{ fontSize: '1rem' }} /> : <CheckBoxOutlineBlankIcon sx={{ fontSize: '1rem' }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Close History">
              <IconButton size="small" onClick={onClose} sx={{ p: 0.4 }}>
                <CloseIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Search Field */}
        <TextField
          size="small"
          placeholder="Search..."
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: '0.9rem', color: theme.palette.text.secondary }} />
              </InputAdornment>
            ),
            sx: {
              borderRadius: 1.5,
              fontSize: '0.78rem',
              py: 0,
              bgcolor: theme.palette.background.paper,
              '& .MuiInputBase-input': { py: 0.6 }
            }
          }}
        />
      </Box>

      {/* Multi-Select Floating Bar */}
      {isMultiSelect && (
        <Box
          sx={{
            px: 1.5,
            py: 0.8,
            bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#ede9fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.divider}`
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: theme.palette.primary.main }}>
            {selectedIds.length} sel.
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              onClick={() =>
                handleSelectAll(
                  activeTab === 'chat'
                    ? filteredChats.map((c) => ({ id: c.id }))
                    : filteredQuizzes.map((q) => ({ id: q.session_id }))
                )
              }
              sx={{ fontSize: '0.68rem', py: 0, minWidth: 32 }}
            >
              All
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              disabled={selectedIds.length === 0 || isBatchDeleting}
              onClick={handleBatchDelete}
              startIcon={isBatchDeleting ? <CircularProgress size={10} color="inherit" /> : undefined}
              sx={{ fontSize: '0.68rem', py: 0.2, px: 1, minWidth: 48 }}
            >
              {isBatchDeleting ? '...' : 'Del'}
            </Button>
          </Box>
        </Box>
      )}

      {/* History Items List */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 0.8 }}>
        <List disablePadding>
          {activeTab === 'chat' && (
            <>
              {filteredChats.length === 0 ? (
                <Typography variant="caption" sx={{ textAlign: 'center', color: theme.palette.text.secondary, display: 'block', mt: 3 }}>
                  No chats found.
                </Typography>
              ) : (
                filteredChats.map((chat) => {
                  const isSelected = selectedChatId === chat.id;
                  const isChecked = selectedIds.includes(chat.id);

                  return (
                    <ListItem
                      key={chat.id}
                      disablePadding
                      sx={{
                        mb: 0.4,
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        bgcolor: isSelected
                          ? theme.palette.mode === 'dark'
                            ? 'rgba(99, 102, 241, 0.2)'
                            : 'rgba(79, 70, 229, 0.1)'
                          : 'transparent',
                        '&:hover .action-buttons': { opacity: 1 }
                      }}
                    >
                      <ListItemButton
                        onClick={() => {
                          if (isMultiSelect) {
                            toggleSelectId(chat.id);
                          } else {
                            onSelectChat(chat.id);
                          }
                        }}
                        sx={{ py: 0.6, px: 1, borderRadius: 1.5 }}
                      >
                        {isMultiSelect && (
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            sx={{ p: 0.2, mr: 0.5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectId(chat.id);
                            }}
                          />
                        )}

                        <ListItemText
                          primary={chat.title || 'Untitled Chat'}
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.2 }}>
                              <DescriptionOutlinedIcon sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary }} />
                              <Typography variant="caption" noWrap sx={{ maxWidth: 120, fontSize: '0.68rem', color: theme.palette.text.secondary }}>
                                {chat.attachedDocName || 'No document'}
                              </Typography>
                            </Box>
                          }
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontSize: '0.78rem',
                            fontWeight: isSelected ? 700 : 500,
                            noWrap: true,
                            color: isSelected ? theme.palette.primary.main : theme.palette.text.primary
                          }}
                        />

                        {/* Hover Actions: Rename and Delete */}
                        {!isMultiSelect && (
                          <Box
                            className="action-buttons"
                            sx={{
                              opacity: 0,
                              transition: 'opacity 0.2s ease',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <Tooltip title="Rename">
                              <IconButton
                                size="small"
                                onClick={(e) => handleOpenRename(chat.id, chat.title, e)}
                                sx={{ p: 0.3 }}
                              >
                                <EditOutlinedIcon sx={{ fontSize: '0.85rem' }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={deletingId === chat.id ? 'Deleting...' : 'Delete'}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={deletingId === chat.id || isBatchDeleting}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      setDeletingId(chat.id);
                                      await onDeleteChats([chat.id]);
                                    } finally {
                                      setDeletingId(null);
                                    }
                                  }}
                                  sx={{ p: 0.3 }}
                                >
                                  {deletingId === chat.id ? (
                                    <CircularProgress size={12} color="error" />
                                  ) : (
                                    <DeleteOutlineIcon sx={{ fontSize: '0.85rem' }} />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        )}
                      </ListItemButton>
                    </ListItem>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'quiz' && (
            <>
              {filteredQuizzes.length === 0 ? (
                <Typography variant="caption" sx={{ textAlign: 'center', color: theme.palette.text.secondary, display: 'block', mt: 3 }}>
                  No quizzes found.
                </Typography>
              ) : (
                filteredQuizzes.map((quiz) => {
                  const isSelected = selectedQuizId === quiz.session_id;
                  const isChecked = selectedIds.includes(quiz.session_id);

                  let statusColor: 'default' | 'primary' | 'warning' | 'success' | 'error' = 'default';
                  if (quiz.status === 'active') statusColor = 'primary';
                  if (quiz.status === 'generating') statusColor = 'warning';
                  if (quiz.status === 'completed') statusColor = 'success';
                  if (quiz.status === 'error') statusColor = 'error';

                  return (
                    <ListItem
                      key={quiz.session_id}
                      disablePadding
                      sx={{
                        mb: 0.4,
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        bgcolor: isSelected
                          ? theme.palette.mode === 'dark'
                            ? 'rgba(99, 102, 241, 0.2)'
                            : 'rgba(79, 70, 229, 0.1)'
                          : 'transparent',
                        '&:hover .action-buttons': { opacity: 1 }
                      }}
                    >
                      <ListItemButton
                        onClick={() => {
                          if (isMultiSelect) {
                            toggleSelectId(quiz.session_id);
                          } else {
                            onSelectQuiz(quiz.session_id);
                          }
                        }}
                        sx={{ py: 0.6, px: 1, borderRadius: 1.5 }}
                      >
                        {isMultiSelect && (
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            sx={{ p: 0.2, mr: 0.5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectId(quiz.session_id);
                            }}
                          />
                        )}

                        <ListItemText
                          primary={quiz.title || 'Untitled Quiz'}
                          secondary={
                            <Chip
                              label={quiz.status}
                              size="small"
                              color={statusColor}
                              variant={quiz.status === 'completed' ? 'filled' : 'outlined'}
                              sx={{
                                height: 16,
                                fontSize: '0.6rem',
                                textTransform: 'capitalize',
                                mt: 0.2
                              }}
                            />
                          }
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontSize: '0.78rem',
                            fontWeight: isSelected ? 700 : 500,
                            noWrap: true,
                            color: isSelected ? theme.palette.primary.main : theme.palette.text.primary
                          }}
                        />

                        {!isMultiSelect && (
                          <Box
                            className="action-buttons"
                            sx={{
                              opacity: 0,
                              transition: 'opacity 0.2s ease',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <Tooltip title="Rename">
                              <IconButton
                                size="small"
                                onClick={(e) => handleOpenRename(quiz.session_id, quiz.title, e)}
                                sx={{ p: 0.3 }}
                              >
                                <EditOutlinedIcon sx={{ fontSize: '0.85rem' }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={deletingId === quiz.session_id ? 'Deleting...' : 'Delete'}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={deletingId === quiz.session_id || isBatchDeleting}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      setDeletingId(quiz.session_id);
                                      await onDeleteQuizzes([quiz.session_id]);
                                    } finally {
                                      setDeletingId(null);
                                    }
                                  }}
                                  sx={{ p: 0.3 }}
                                >
                                  {deletingId === quiz.session_id ? (
                                    <CircularProgress size={12} color="error" />
                                  ) : (
                                    <DeleteOutlineIcon sx={{ fontSize: '0.85rem' }} />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        )}
                      </ListItemButton>
                    </ListItem>
                  );
                })
              )}
            </>
          )}
        </List>
      </Box>

      {/* Rename Dialog */}
      <Dialog open={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700 }}>Rename Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Session Title"
            fullWidth
            size="small"
            variant="outlined"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setRenameTarget(null)} disabled={renaming}>Cancel</Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleConfirmRename}
            disabled={!newTitle.trim() || renaming}
            startIcon={renaming ? <CircularProgress size={12} color="inherit" /> : null}
          >
            {renaming ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
