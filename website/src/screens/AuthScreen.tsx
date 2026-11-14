import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  useTheme
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import SchoolIcon from '@mui/icons-material/School';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { supabase } from '../services/supabase';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0); // 0 = Sign In, 1 = Sign Up
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (tabIndex === 1 && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (tabIndex === 1 && password.length < 6) {
      setErrorMsg('Password should be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      if (tabIndex === 0) {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        onAuthSuccess();
      } else {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password
        });
        if (error) throw error;
        if (data.session) {
          onAuthSuccess();
        } else {
          setSuccessMsg('Sign-up successful! Please check your email or proceed to sign in.');
          setTabIndex(0);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: theme.palette.background.default,
        p: 2
      }}
    >
      <Card
        sx={{
          maxWidth: 440,
          width: '100%',
          p: 3,
          borderRadius: 4,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 10px 30px rgba(0,0,0,0.5)'
              : '0 10px 30px rgba(79, 70, 229, 0.08)',
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <CardContent sx={{ p: '0 !important' }}>
          {/* Brand Header */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 3,
                bgcolor: theme.palette.primary.main,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                mb: 1.5,
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)'
              }}
            >
              <SchoolIcon sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
              StudyBuddy
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5, textAlign: 'center' }}>
              Your intelligent AI study partner for grounded notes & quizzes
            </Typography>
          </Box>

          {/* Tab Selector */}
          <Tabs
            value={tabIndex}
            onChange={(_, val) => {
              setTabIndex(val);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            variant="fullWidth"
            sx={{
              mb: 3,
              borderBottom: `1px solid ${theme.palette.divider}`,
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none'
              }
            }}
          >
            <Tab label="Sign In" />
            <Tab label="Create Account" />
          </Tabs>

          {/* Status Banners */}
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {errorMsg}
            </Alert>
          )}
          {successMsg && (
            <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }}>
              {successMsg}
            </Alert>
          )}

          {/* Auth Form */}
          <Box component="form" onSubmit={handleAuthSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {tabIndex === 1 && (
              <TextField
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                fullWidth
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  )
                }}
              />
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
              sx={{
                py: 1.3,
                mt: 1,
                fontWeight: 700,
                borderRadius: 2
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : tabIndex === 0 ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

