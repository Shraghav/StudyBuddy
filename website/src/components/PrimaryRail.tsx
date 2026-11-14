import React from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Avatar,
  Divider,
  useTheme
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SchoolIcon from '@mui/icons-material/School';
import { NavTab } from '../types';

interface PrimaryRailProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  userEmail?: string;
}

export const PrimaryRail: React.FC<PrimaryRailProps> = ({
  activeTab,
  onTabChange,
  isDark,
  onToggleTheme,
  onLogout,
  onOpenProfile,
  userEmail
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: 72,
        height: '100vh',
        bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2,
        zIndex: 10,
        flexShrink: 0
      }}
    >
      {/* Top: Logo & Main Navigation Tabs */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Tooltip title="StudyBuddy" placement="right">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              bgcolor: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              mb: 1.5,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
          >
            <SchoolIcon fontSize="medium" />
          </Box>
        </Tooltip>

        <Tooltip title="AI Chat Assistant" placement="right">
          <IconButton
            onClick={() => onTabChange('chat')}
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              bgcolor:
                activeTab === 'chat'
                  ? theme.palette.primary.main
                  : 'transparent',
              color:
                activeTab === 'chat'
                  ? '#ffffff'
                  : theme.palette.text.secondary,
              '&:hover': {
                bgcolor:
                  activeTab === 'chat'
                    ? theme.palette.primary.dark
                    : theme.palette.action.hover
              }
            }}
          >
            <ChatBubbleOutlineIcon fontSize="medium" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Quiz Arena" placement="right">
          <IconButton
            onClick={() => onTabChange('quiz')}
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              bgcolor:
                activeTab === 'quiz'
                  ? theme.palette.primary.main
                  : 'transparent',
              color:
                activeTab === 'quiz'
                  ? '#ffffff'
                  : theme.palette.text.secondary,
              '&:hover': {
                bgcolor:
                  activeTab === 'quiz'
                    ? theme.palette.primary.dark
                    : theme.palette.action.hover
              }
            }}
          >
            <QuizOutlinedIcon fontSize="medium" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Documents Knowledge Hub" placement="right">
          <IconButton
            onClick={() => onTabChange('documents')}
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              bgcolor:
                activeTab === 'documents'
                  ? theme.palette.primary.main
                  : 'transparent',
              color:
                activeTab === 'documents'
                  ? '#ffffff'
                  : theme.palette.text.secondary,
              '&:hover': {
                bgcolor:
                  activeTab === 'documents'
                    ? theme.palette.primary.dark
                    : theme.palette.action.hover
              }
            }}
          >
            <FolderOpenOutlinedIcon fontSize="medium" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Bottom: Theme Toggle & User Avatar / Sign Out */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} placement="right">
          <IconButton onClick={onToggleTheme} size="small" sx={{ color: theme.palette.text.secondary }}>
            {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: 36 }} />

        <Tooltip title="View Profile & Stats" placement="right">
          <IconButton onClick={onOpenProfile} size="small" sx={{ p: 0.5 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                fontSize: '0.875rem',
                bgcolor: theme.palette.secondary.main,
                color: '#fff',
                cursor: 'pointer',
                transition: 'transform 0.2s ease',
                '&:hover': { transform: 'scale(1.1)' }
              }}
            >
              {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Tooltip title="Sign Out" placement="right">
          <IconButton onClick={onLogout} size="small" color="error">
            <LogoutOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

