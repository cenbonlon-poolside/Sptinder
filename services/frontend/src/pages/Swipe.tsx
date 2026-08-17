import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Favorite,
  Close,
  PlayArrow,
  Pause,
  VolumeUp,
} from '@mui/icons-material';
import { Song } from '../types';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

interface SwipeCardProps {
  song: Song;
  onSwipe: (direction: 'like' | 'dislike') => void;
  style?: React.CSSProperties;
}

const SwipeCard: React.FC<SwipeCardProps> = ({ song, onSwipe, style }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (song.previewUrl) {
      const audio = new Audio(song.previewUrl);
      audio.volume = 0.3;
      setAudioElement(audio);

      return () => {
        audio.pause();
        audio.currentTime = 0;
      };
    }
  }, [song.previewUrl]);

  const togglePlayback = () => {
    if (!audioElement) return;

    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.play();
      setIsPlaying(true);
      audioElement.onended = () => setIsPlaying(false);
    }
  };

  return (
    <div className="swipe-card" style={style}>
      <div className="swipe-card-content">
        <img
          src={song.imageUrl || '/default-album-art.png'}
          alt={`${song.album} cover`}
          className="album-art"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/default-album-art.png';
          }}
        />

        <div className="song-info">
          <h2 className="song-title">{song.name}</h2>
          <p className="song-artist">{song.artist}</p>
          <p className="song-album">{song.album}</p>

          {song.genres && song.genres.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
              {song.genres.slice(0, 3).map((genre, index) => (
                <Chip
                  key={index}
                  label={genre}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(29, 185, 84, 0.2)',
                    color: '#1db954',
                    fontSize: '0.7rem',
                  }}
                />
              ))}
            </Box>
          )}
        </div>

        {song.previewUrl && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <IconButton
              onClick={togglePlayback}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Box>
        )}
      </div>

      <div className="swipe-actions">
        <button
          className="swipe-button dislike"
          onClick={() => onSwipe('dislike')}
          aria-label="Dislike song"
        >
          <Close sx={{ fontSize: 32, color: '#ffffff' }} />
        </button>

        <button
          className="swipe-button like"
          onClick={() => onSwipe('like')}
          aria-label="Like song"
        >
          <Favorite sx={{ fontSize: 32, color: '#ffffff' }} />
        </button>
      </div>
    </div>
  );
};

const Swipe: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swiping, setSwiping] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    loadSongs();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('newMatch', (data: any) => {
        // Handle new match notification
        console.log('New match!', data);
      });
    }

    return () => {
      if (socket) {
        socket.off('newMatch');
      }
    };
  }, [socket]);

  const loadSongs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getSongsForSwiping({ limit: 20 });
      setSongs(response.songs);
      setCurrentIndex(0);
    } catch (err) {
      setError('Failed to load songs. Please try again.');
      console.error('Error loading songs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction: 'like' | 'dislike') => {
    if (swiping || songs.length === 0) return;

    const currentSong = songs[currentIndex];
    setSwiping(true);

    try {
      await api.recordSwipe(currentSong.id, direction);

      // Move to next song
      if (currentIndex >= songs.length - 3) {
        // Load more songs when running low
        loadSongs();
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error recording swipe:', err);
      // Still move to next song even if API call fails
      setCurrentIndex(prev => prev + 1);
    } finally {
      setSwiping(false);
    }
  };

  if (loading) {
    return (
      <Box className="loading-container">
        <CircularProgress size={60} />
        <Typography sx={{ mt: 2, color: '#b3b3b3' }}>
          Loading songs...
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
            onClick={loadSongs}
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

  if (songs.length === 0 || currentIndex >= songs.length) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          p: 3,
        }}
      >
        <Typography variant="h5" sx={{ color: '#ffffff', mb: 2 }}>
          No more songs to swipe!
        </Typography>
        <Typography sx={{ color: '#b3b3b3', textAlign: 'center', mb: 3 }}>
          Check back later for more music recommendations, or adjust your preferences in your profile.
        </Typography>
        <button
          onClick={loadSongs}
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
          Refresh Songs
        </button>
      </Box>
    );
  }

  const currentSong = songs[currentIndex];

  return (
    <Box
      sx={{
        height: 'calc(100vh - 112px)', // Account for header and bottom nav
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <SwipeCard
        song={currentSong}
        onSwipe={handleSwipe}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '400px',
          height: '70vh',
          maxHeight: '600px',
        }}
      />
    </Box>
  );
};

export default Swipe;