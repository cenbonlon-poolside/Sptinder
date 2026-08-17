import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { MusicNote } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    // Handle OAuth callback
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (code) {
      // Exchange code for token
      api.exchangeCode(code).then(({ token }) => {
        login(token);
        navigate('/swipe');
      }).catch((err) => {
        console.error('Failed to exchange code', err);
        setError('Authentication failed. Please try again.');
        setLoading(false);
      });
    } else if (errorParam) {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams, login, navigate]);

  const handleSpotifyLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.initiateSpotifyAuth();
      window.location.href = response.url;
    } catch (err) {
      setError('Failed to initiate Spotify login. Please try again.');
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
        background: 'linear-gradient(135deg, #121212 0%, #1e1e1e 100%)',
        p: 2,
      }}
    >
      <Paper
        elevation={24}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
          background: 'rgba(30, 30, 30, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: 3,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <MusicNote sx={{ fontSize: 64, color: '#1db954', mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#ffffff' }}>
            Sptinder
          </Typography>
          <Typography variant="h6" sx={{ color: '#b3b3b3', mb: 1 }}>
            Music Tinder
          </Typography>
          <Typography variant="body1" sx={{ color: '#888888' }}>
            Swipe through songs, find your perfect music match
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          onClick={handleSpotifyLogin}
          disabled={loading}
          sx={{
            background: 'linear-gradient(135deg, #1db954 0%, #1aa34a 100%)',
            color: '#ffffff',
            px: 4,
            py: 1.5,
            fontSize: '1.1rem',
            fontWeight: 600,
            borderRadius: 3,
            textTransform: 'none',
            boxShadow: '0 4px 12px rgba(29, 185, 84, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #1aa34a 0%, #15803d 100%)',
              boxShadow: '0 6px 20px rgba(29, 185, 84, 0.4)',
            },
            '&:disabled': {
              background: '#333333',
              color: '#666666',
            },
          }}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <MusicNote />}
        >
          {loading ? 'Connecting...' : 'Login with Spotify'}
        </Button>

        <Typography variant="body2" sx={{ mt: 3, color: '#666666' }}>
          By logging in, you agree to connect your Spotify account to discover music preferences.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Login;