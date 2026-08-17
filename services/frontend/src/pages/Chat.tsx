import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import { Send, ArrowBack } from '@mui/icons-material';
import { ChatMessage, Match } from '../types';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

const Chat: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (matchId) {
      loadMatchDetails();
      loadMessages();
    }
  }, [matchId]);

  useEffect(() => {
    if (socket && matchId) {
      socket.on('newMessage', (data: any) => {
        if (data.matchId === matchId) {
          setMessages(prev => [...prev, data.message]);
          scrollToBottom();
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('newMessage');
      }
    };
  }, [socket, matchId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMatchDetails = async () => {
    try {
      const response = await api.getMatchDetails(matchId!);
      setMatch(response.match);
    } catch (err) {
      setError('Failed to load match details.');
      console.error('Error loading match details:', err);
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getChatMessages(matchId!);
      setMessages(response.messages);
    } catch (err) {
      setError('Failed to load messages.');
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const response = await api.sendMessage(matchId!, newMessage.trim());
      setMessages(prev => [...prev, response.message]);
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <Box className="loading-container">
        <CircularProgress size={60} />
        <Typography sx={{ mt: 2, color: '#b3b3b3' }}>
          Loading chat...
        </Typography>
      </Box>
    );
  }

  if (error || !match) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Failed to load chat.'}
        </Alert>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/matches')}
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
            Back to Matches
          </button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 112px)', // Account for header and bottom nav
        bgcolor: '#121212',
      }}
    >
      {/* Chat Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          bgcolor: '#1e1e1e',
          borderBottom: '1px solid #333',
        }}
      >
        <IconButton
          onClick={() => navigate('/matches')}
          sx={{ color: '#ffffff', mr: 1 }}
        >
          <ArrowBack />
        </IconButton>
        <Avatar
          src={match.user.profileImageUrl}
          alt={match.user.displayName || 'User'}
          sx={{ width: 40, height: 40, mr: 2 }}
        >
          {match.user.displayName?.charAt(0) || 'U'}
        </Avatar>
        <Typography variant="h6" sx={{ color: '#ffffff', flex: 1 }}>
          {match.user.displayName || 'Music Lover'}
        </Typography>
      </Box>

      {/* Messages */}
      <Box
        className="chat-messages"
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
        }}
      >
        {messages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ color: '#b3b3b3', mb: 1 }}>
              Start a conversation! 🎵
            </Typography>
            <Typography variant="body2" sx={{ color: '#666666' }}>
              Share your favorite songs or ask about theirs
            </Typography>
          </Box>
        ) : (
          messages.map((message) => (
            <Box
              key={message.id}
              className={`message ${message.senderId === localStorage.getItem('userId') ? 'sent' : 'received'}`}
              sx={{
                display: 'flex',
                mb: 1,
                alignItems: 'flex-start',
              }}
            >
              {message.senderId !== localStorage.getItem('userId') && (
                <Avatar
                  src={message.sender.profileImageUrl}
                  alt={message.sender.displayName || 'User'}
                  sx={{ width: 32, height: 32, mr: 1, mt: 0.5 }}
                >
                  {message.sender.displayName?.charAt(0) || 'U'}
                </Avatar>
              )}
              <Box
                sx={{
                  maxWidth: '70%',
                  ml: message.senderId === localStorage.getItem('userId') ? 'auto' : 0,
                }}
              >
                <Paper
                  sx={{
                    p: 1.5,
                    bgcolor: message.senderId === localStorage.getItem('userId') ? '#1db954' : '#2a2a2a',
                    color: '#ffffff',
                    borderRadius: 3,
                    wordWrap: 'break-word',
                  }}
                >
                  <Typography variant="body1">{message.content}</Typography>
                </Paper>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#666666',
                    mt: 0.5,
                    display: 'block',
                    textAlign: message.senderId === localStorage.getItem('userId') ? 'right' : 'left',
                  }}
                >
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              </Box>
            </Box>
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box className="message-input">
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={sending}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: '#1e1e1e',
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
            '& .MuiOutlinedInput-input': {
              '&::placeholder': {
                color: '#666666',
              },
            },
          }}
        />
        <IconButton
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || sending}
          sx={{
            color: '#1db954',
            '&:hover': {
              bgcolor: 'rgba(29, 185, 84, 0.1)',
            },
            '&:disabled': {
              color: '#666666',
            },
          }}
        >
          {sending ? <CircularProgress size={24} /> : <Send />}
        </IconButton>
      </Box>
    </Box>
  );
};

export default Chat;