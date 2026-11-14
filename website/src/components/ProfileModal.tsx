import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Avatar,
  Paper,
  Button,
  LinearProgress,
  useTheme
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import CloseIcon from '@mui/icons-material/Close';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  userEmail: string;
  totalDocuments: number;
  totalChats: number;
  totalQuizzes: number;
  maxQuizzes?: number;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  onClose,
  userEmail,
  totalDocuments,
  totalChats,
  totalQuizzes,
  maxQuizzes = 50
}) => {
  const theme = useTheme();

  const userName = userEmail ? userEmail.split('@')[0] : 'Student';
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);
  const quizQuotaPct = Math.min(100, Math.round((totalQuizzes / maxQuizzes) * 100));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={800}>
          User Profile
        </Typography>
        <Button size="small" onClick={onClose} sx={{ minWidth: 32, p: 0.5 }}>
          <CloseIcon fontSize="small" />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        {/* User Identity Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: theme.palette.primary.main,
              color: '#fff',
              fontSize: '1.4rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
          >
            {userEmail ? userEmail.charAt(0).toUpperCase() : <PersonOutlineIcon />}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.palette.text.primary }}>
              {formattedName}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {userEmail}
            </Typography>
          </Box>
        </Box>

        {/* User Stats Grid */}
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5, display: 'block' }}>
          Study Statistics
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {/* Total Documents */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <DescriptionOutlinedIcon color="primary" />
              <Typography variant="body2" fontWeight={600}>
                Total Documents Uploaded
              </Typography>
            </Box>
            <Typography variant="h6" fontWeight={800} color="primary">
              {totalDocuments}
            </Typography>
          </Paper>

          {/* Total Chats */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ChatBubbleOutlineIcon color="secondary" />
              <Typography variant="body2" fontWeight={600}>
                Total Chats Created
              </Typography>
            </Box>
            <Typography variant="h6" fontWeight={800} color="secondary">
              {totalChats}
            </Typography>
          </Paper>

          {/* Total Quizzes Attempted */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <QuizOutlinedIcon color="success" />
                <Typography variant="body2" fontWeight={600}>
                  Total Quizzes Attempted
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight={800} color="success.main">
                {totalQuizzes} / {maxQuizzes}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={quizQuotaPct}
              sx={{ height: 6, borderRadius: 3, bgcolor: theme.palette.divider }}
            />
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} fullWidth variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

