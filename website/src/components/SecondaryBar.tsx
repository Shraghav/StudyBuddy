import React from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { NavTab } from '../types';

interface SecondaryBarProps {
  activeTab: NavTab;
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
  onNewAction: () => void;
  activeCount?: number;
}

export const SecondaryBar: React.FC<SecondaryBarProps> = ({
  activeTab,
  isHistoryOpen,
  onToggleHistory,
  onNewAction,
  activeCount = 0
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: 165,
        height: '100vh',
        bgcolor: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        p: 1.5,
        flexShrink: 0
      }}
    >
      {/* Workspace Header */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="caption"
          sx={{
            textTransform: 'uppercase',
            color: theme.palette.text.secondary,
            fontWeight: 700,
            fontSize: '0.68rem',
            letterSpacing: 0.6
          }}
        >
          Workspace
        </Typography>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            lineHeight: 1.2,
            mt: 0.3
          }}
        >
          {activeTab === 'chat' && 'AI Chat'}
          {activeTab === 'quiz' && 'Quiz Arena'}
          {activeTab === 'documents' && 'Documents'}
        </Typography>
      </Box>

      {/* Primary Action Button (+ New Chat or + New Quiz) */}
      {activeTab !== 'documents' && (
        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={onNewAction}
          sx={{
            py: 0.8,
            mb: 2,
            fontWeight: 600,
            fontSize: '0.8rem',
            borderRadius: 2
          }}
        >
          {activeTab === 'chat' ? 'New Chat' : 'New Quiz'}
        </Button>
      )}

      {/* Section Items */}
      <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {/* Item: History Drawer Trigger (Opens 3rd bar) */}
        {activeTab !== 'documents' && (
          <ListItemButton
            onClick={onToggleHistory}
            selected={isHistoryOpen}
            sx={{
              borderRadius: 2,
              py: 0.8,
              px: 1,
              bgcolor: isHistoryOpen
                ? theme.palette.mode === 'dark'
                  ? 'rgba(99, 102, 241, 0.15)'
                  : 'rgba(79, 70, 229, 0.08)'
                : 'transparent',
              '&.Mui-selected': {
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(99, 102, 241, 0.2)'
                    : 'rgba(79, 70, 229, 0.12)'
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: isHistoryOpen ? theme.palette.primary.main : theme.palette.text.secondary }}>
              <HistoryIcon sx={{ fontSize: '1.1rem' }} />
            </ListItemIcon>
            <ListItemText
              primary={activeTab === 'chat' ? 'Chat History' : 'Quiz History'}
              primaryTypographyProps={{
                variant: 'body2',
                fontSize: '0.78rem',
                fontWeight: isHistoryOpen ? 700 : 500,
                color: isHistoryOpen ? theme.palette.primary.main : theme.palette.text.primary
              }}
            />
            {activeCount > 0 && (
              <Chip
                label={activeCount}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  mr: 0.3,
                  bgcolor: theme.palette.mode === 'dark' ? '#1f2937' : '#e2e8f0'
                }}
              />
            )}
            <ChevronRightIcon
              sx={{
                fontSize: '1rem',
                color: theme.palette.text.secondary,
                transform: isHistoryOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.2s ease'
              }}
            />
          </ListItemButton>
        )}

        {activeTab === 'quiz' && (
          <ListItemButton
            sx={{
              borderRadius: 2,
              py: 0.8,
              px: 1
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: theme.palette.text.secondary }}>
              <InsightsOutlinedIcon sx={{ fontSize: '1.1rem' }} />
            </ListItemIcon>
            <ListItemText
              primary="Quiz Quota"
              secondary={`${activeCount}/50 Active`}
              primaryTypographyProps={{ variant: 'body2', fontSize: '0.78rem', color: theme.palette.text.primary }}
              secondaryTypographyProps={{ variant: 'caption', fontSize: '0.65rem', color: theme.palette.text.secondary }}
            />
          </ListItemButton>
        )}

        {activeTab === 'documents' && (
          <ListItemButton
            selected
            sx={{
              borderRadius: 2,
              py: 0.8,
              px: 1
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: theme.palette.primary.main }}>
              <DescriptionOutlinedIcon sx={{ fontSize: '1.1rem' }} />
            </ListItemIcon>
            <ListItemText
              primary="All Documents"
              primaryTypographyProps={{ variant: 'body2', fontSize: '0.78rem', fontWeight: 600, color: theme.palette.primary.main }}
            />
          </ListItemButton>
        )}
      </List>

      <Box sx={{ mt: 'auto', pt: 1.5 }}>
        <Divider sx={{ mb: 1 }} />
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', fontSize: '0.65rem' }}>
          StudyBuddy v1.0
        </Typography>
      </Box>
    </Box>
  );
};
