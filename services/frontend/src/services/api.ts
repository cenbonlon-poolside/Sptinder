import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, ApiError } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/v1` : '/api/v1';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle common errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }

        const message = error.response?.data?.error || error.message || 'An error occurred';
        const statusCode = error.response?.status || 500;

        throw new ApiError(message, statusCode);
      }
    );
  }

  // Auth endpoints
  async initiateSpotifyAuth(): Promise<{ url: string }> {
    const response = await this.api.get('/auth/spotify');
    return response.data;
  }

  async getCurrentUser(): Promise<{ user: any }> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async refreshToken(): Promise<{ token: string; expiresIn: string }> {
    const response = await this.api.post('/auth/refresh');
    return response.data;
  }

  async logout(): Promise<{ message: string }> {
    const response = await this.api.post('/auth/logout');
    return response.data;
  }

  async exchangeCode(code: string): Promise<{ token: string }> {
    const response = await this.api.post('/auth/exchange', { code });
    return response.data;
  }

  // Songs endpoints
  async getSongsForSwiping(params?: {
    limit?: number;
    genre?: string;
    popularity?: number;
  }): Promise<{ songs: any[] }> {
    const response = await this.api.get('/songs', { params });
    return response.data;
  }

  async getSongDetails(songId: string): Promise<{ song: any }> {
    const response = await this.api.get(`/songs/${songId}`);
    return response.data;
  }

  async searchSongs(query: string, limit?: number): Promise<{ songs: any[] }> {
    const response = await this.api.get(`/songs/search/${query}`, {
      params: { limit }
    });
    return response.data;
  }

  // Swipes endpoints
  async recordSwipe(songId: string, direction: 'like' | 'dislike'): Promise<{
    swipe: any;
    match?: any;
  }> {
    const response = await this.api.post('/swipes', { songId, direction });
    return response.data;
  }

  async getSwipeHistory(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ swipes: any[]; pagination: any }> {
    const response = await this.api.get('/swipes/history', { params });
    return response.data;
  }

  // Matches endpoints
  async getMatches(): Promise<{ matches: any[] }> {
    const response = await this.api.get('/matches');
    return response.data;
  }

  async getMatchDetails(matchId: string): Promise<{ match: any }> {
    const response = await this.api.get(`/matches/${matchId}`);
    return response.data;
  }

  async getChatMessages(matchId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<{ messages: any[]; pagination: any }> {
    const response = await this.api.get(`/matches/${matchId}/messages`, { params });
    return response.data;
  }

  async sendMessage(matchId: string, content: string, messageType?: string, metadata?: any): Promise<{ message: any }> {
    const response = await this.api.post(`/matches/${matchId}/messages`, {
      content,
      messageType,
      metadata
    });
    return response.data;
  }

  // Users endpoints
  async getProfile(): Promise<{ user: any }> {
    const response = await this.api.get('/users/profile');
    return response.data;
  }

  async updateProfile(data: { displayName: string }): Promise<{ user: any }> {
    const response = await this.api.put('/users/profile', data);
    return response.data;
  }

  async getPlaylists(): Promise<{ playlists: { spotify: any[]; collaborative: any[] } }> {
    const response = await this.api.get('/users/playlists');
    return response.data;
  }

  async createPlaylist(data: {
    name: string;
    description?: string;
    isPublic: boolean;
    songIds: string[];
  }): Promise<{ playlist: any }> {
    const response = await this.api.post('/users/playlists', data);
    return response.data;
  }

  // Generic request methods
  async get<T = any>(url: string, params?: any): Promise<T> {
    const response = await this.api.get(url, { params });
    return response.data;
  }

  async post<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.api.post(url, data);
    return response.data;
  }

  async put<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.api.put(url, data);
    return response.data;
  }

  async delete<T = any>(url: string): Promise<T> {
    const response = await this.api.delete(url);
    return response.data;
  }
}

export const api = new ApiService();