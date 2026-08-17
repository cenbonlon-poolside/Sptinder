// User types
export interface User {
  id: string;
  spotifyId: string;
  email?: string;
  displayName?: string;
  profileImageUrl?: string;
  country?: string;
  createdAt: string;
  _count?: {
    swipes: number;
    matches: number;
  };
}

// Auth context type
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

// Socket context type
export interface SocketContextType {
  socket: any; // Socket.io socket instance
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

// Song types
export interface Song {
  id: string;
  spotifyId: string;
  name: string;
  artist: string;
  album: string;
  imageUrl?: string;
  previewUrl?: string;
  externalUrl: string;
  durationMs: number;
  popularity: number;
  genres: string[];
  audioFeatures?: AudioFeatures;
}

export interface AudioFeatures {
  id: string;
  songId: string;
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  timeSignature: number;
  createdAt: string;
}

// Swipe types
export interface Swipe {
  id: string;
  songId: string;
  direction: 'like' | 'dislike';
  createdAt: string;
  song?: Song;
}

// Match types
export interface Match {
  id: string;
  user: User;
  createdAt: string;
  lastMessage?: {
    content: string;
    createdAt: string;
    senderId: string;
    senderName: string;
  };
}

export interface MatchDetails {
  id: string;
  user: User;
  createdAt: string;
}

// Chat types
export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'song' | 'playlist';
  metadata?: any;
  readAt?: string;
  createdAt: string;
  sender: {
    id: string;
    displayName?: string;
    profileImageUrl?: string;
  };
}

// Playlist types
export interface Playlist {
  id: string;
  spotifyId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  externalUrl: string;
  trackCount: number;
  isPublic: boolean;
  owner?: User;
  createdAt?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: any;
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface ProfileFormData {
  displayName: string;
}

export interface PlaylistFormData {
  name: string;
  description?: string;
  isPublic: boolean;
  songIds: string[];
}

// Component props types
export interface SwipeCardProps {
  song: Song;
  onSwipe: (direction: 'like' | 'dislike') => void;
  style?: React.CSSProperties;
}

export interface ChatMessageProps {
  message: ChatMessage;
  isOwn: boolean;
}

export interface MatchCardProps {
  match: Match;
  onClick: () => void;
}

// Error types
export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}