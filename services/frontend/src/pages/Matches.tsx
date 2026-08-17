import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Badge,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { Chat, Favorite } from '@mui/icons-material';
import { Match } from '../types';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

const Matches: React.FC = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocket();

  useEffect(() => {
    loadMatches();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('newMessage', (data: any) => {
        // Refresh matches when new message arrives
        loadMatches();
      });

      socket.on('newMatch', (data: any) => {
        // Add new match to the list
        loadMatches();
      });
    }

    return () => {
      if (socket) {
        socket.off('newMessage');
        socket.off('newMatch');
      }
    };
  }, [socket]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getMatches();
      setMatches(response.matches);
    } catch (err) {
      setError('Failed to load matches. Please try again.');
      console.error('Error loading matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchClick = (matchId: string) => {
    navigate(`/chat/${matchId}`);
  };

  const formatLastMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <Box className="loading-container">
        <CircularProgress size={60} />
        <Typography sx={{ mt: 2, color: '#b3b3b3' }}>
          Loading matches...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={loadMatches}
            style={{
              padding: '12px 24px',
              background: '#1db954',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            Try Again
          </button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ color: '#ffffff', mb: 3, textAlign: 'center' }}>
        Your Matches
      </Typography>

      {matches.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            textAlign: 'center',
          }}
        >
          <Favorite sx={{ fontSize: 64, color: '#666666', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
            No matches yet
          </Typography>
          <Typography sx={{ color: '#b3b3b3', mb: 3 }}>
            Keep swiping to find your music soulmate!
          </Typography>
          <button
            onClick={() => navigate('/swipe')}
            style={{
              padding: '12px 24px',
              background: '#1db954',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            Start Swiping
          </button>
        </Box>
      ) : (
        <List sx={{ width: '100%', bgcolor: 'transparent' }}>
          {matches.map((match) => (
            <ListItem
              key={match.id}
              onClick={() => handleMatchClick(match.id)}
              sx={{
                bgcolor: '#1e1e1e',
                borderRadius: 2,
                mb: 1,
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: '#2a2a2a',
                },
                transition: 'background-color 0.2s',
              }}
            >
              <ListItemAvatar>
                <Badge
                  color="success"
                  variant="dot"
                  invisible={!match.lastMessage || match.lastMessage.senderId === match.user.id}
                >
                  <Avatar
                    src={match.user.profileImageUrl}
                    alt={match.user.displayName || 'User'}
                    sx={{ width: 50, height: 50 }}
                  >
                    {match.user.displayName?.charAt(0) || 'U'}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="h6" sx={{ color: '#ffffff' }}>
                    {match.user.displayName || 'Music Lover'}
                  </Typography>
                }
                secondary={
                  <Box>
                    {match.lastMessage ? (
                      <Typography
                        variant="body2"
                        sx={{
                          color: match.lastMessage.senderId === match.user.id ? '#ffffff' : '#b3b3b3',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {match.lastMessage.senderId === match.user.id ? '' : 'You: '}
                        {match.lastMessage.content}
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#666666' }}>
                        Say hello! 👋
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: '#666666' }}>
                      {formatLastMessageTime(match.createdAt)}
                    </Typography>
                  </Box>
                }
              />
              <Chat sx={{ color: '#1db954', ml: 1 }} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default Matches;