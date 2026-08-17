import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Avatar,
  TextField,
  Button,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { Edit, Save, Cancel } from '@mui/icons-material';
import { User } from '../types';
import { api } from '../services/api';

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getProfile();
      setUser(response.user);
      setEditForm({
        displayName: response.user.displayName || '',
      });
    } catch (err) {
      setError('Failed to load profile. Please try again.');
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    if (user) {
      setEditForm({
        displayName: user.displayName || '',
      });
    }
  };

  const handleSave = async () => {
    try {
      setUpdating(true);
      setError(null);

      const response = await api.updateProfile(editForm);
      setUser(response.user);
      setEditing(false);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error('Error updating profile:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading) {
    return (
      <Box className="loading-container">
        <CircularProgress size={60} />
        <Typography sx={{ mt: 2, color: '#b3b3b3' }}>
          Loading profile...
        </Typography>
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Failed to load profile.'}
        </Alert>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            onClick={loadProfile}
            variant="contained"
            sx={{
              background: '#1db954',
              '&:hover': {
                background: '#1aa34a',
              },
            }}
          >
            Try Again
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ color: '#ffffff', mb: 3, textAlign: 'center' }}>
        Your Profile
      </Typography>

      {/* Profile Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: '#1e1e1e', borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar
            src={user.profileImageUrl}
            alt={user.displayName || 'User'}
            sx={{ width: 80, height: 80, mr: 3 }}
          >
            {user.displayName?.charAt(0) || 'U'}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            {editing ? (
              <TextField
                fullWidth
                label="Display Name"
                value={editForm.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: '#333',
                    },
                    '&:hover fieldset': {
                      borderColor: '#1db954',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1db954',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b3b3b3',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#1db954',
                  },
                }}
              />
            ) : (
              <Typography variant="h5" sx={{ color: '#ffffff', mb: 1 }}>
                {user.displayName || 'Music Lover'}
              </Typography>
            )}
            <Typography sx={{ color: '#b3b3b3' }}>
              @{user.spotifyId}
            </Typography>
            {user.country && (
              <Typography sx={{ color: '#666666', mt: 0.5 }}>
                📍 {user.country}
              </Typography>
            )}
          </Box>
          <Box>
            {editing ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={handleSave}
                  disabled={updating}
                  startIcon={updating ? <CircularProgress size={16} /> : <Save />}
                  variant="contained"
                  sx={{
                    background: '#1db954',
                    '&:hover': {
                      background: '#1aa34a',
                    },
                  }}
                >
                  Save
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={updating}
                  startIcon={<Cancel />}
                  variant="outlined"
                  sx={{
                    borderColor: '#666666',
                    color: '#b3b3b3',
                    '&:hover': {
                      borderColor: '#999999',
                      color: '#ffffff',
                    },
                  }}
                >
                  Cancel
                </Button>
              </Box>
            ) : (
              <Button
                onClick={handleEdit}
                startIcon={<Edit />}
                variant="outlined"
                sx={{
                  borderColor: '#1db954',
                  color: '#1db954',
                  '&:hover': {
                    borderColor: '#1aa34a',
                    color: '#1aa34a',
                    bgcolor: 'rgba(29, 185, 84, 0.1)',
                  },
                }}
              >
                Edit Profile
              </Button>
            )}
          </Box>
        </Box>

        {/* Stats */}
        <Grid container spacing={3}>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: '#1db954', fontWeight: 'bold' }}>
                {user._count?.swipes || 0}
              </Typography>
              <Typography sx={{ color: '#b3b3b3' }}>Swipes</Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: '#1db954', fontWeight: 'bold' }}>
                {user._count?.matches || 0}
              </Typography>
              <Typography sx={{ color: '#b3b3b3' }}>Matches</Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: '#1db954', fontWeight: 'bold' }}>
                {Math.floor((user._count?.swipes || 0) * 0.1)}
              </Typography>
              <Typography sx={{ color: '#b3b3b3' }}>Likes</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Account Information */}
      <Paper sx={{ p: 3, bgcolor: '#1e1e1e', borderRadius: 3 }}>
        <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
          Account Information
        </Typography>
        <List>
          <ListItem>
            <ListItemText
              primary="Spotify ID"
              secondary={user.spotifyId}
              primaryTypographyProps={{ sx: { color: '#ffffff' } }}
              secondaryTypographyProps={{ sx: { color: '#b3b3b3' } }}
            />
          </ListItem>
          <Divider sx={{ bgcolor: '#333' }} />
          <ListItem>
            <ListItemText
              primary="Email"
              secondary={user.email || 'Not provided'}
              primaryTypographyProps={{ sx: { color: '#ffffff' } }}
              secondaryTypographyProps={{ sx: { color: '#b3b3b3' } }}
            />
          </ListItem>
          <Divider sx={{ bgcolor: '#333' }} />
          <ListItem>
            <ListItemText
              primary="Member Since"
              secondary={new Date(user.createdAt).toLocaleDateString()}
              primaryTypographyProps={{ sx: { color: '#ffffff' } }}
              secondaryTypographyProps={{ sx: { color: '#b3b3b3' } }}
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
};

export default Profile;