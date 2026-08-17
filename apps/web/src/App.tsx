import React, { useState, useEffect } from 'react';

type Track = {
  id: string;
  spotifyId: string;
  name: string;
  artist: string;
  album: string | null;
  previewUrl: string | null;
  imageUrl: string | null;
  durationMs: number | null;
  popularity: number | null;
};

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://sptinder-api.onrender.com';

function App() {
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read token from URL hash fragment (set by callback after OAuth)
  // This bypasses Chrome's bounce tracking protection on httpOnly cookies
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove #
    const hashParams = new URLSearchParams(hash);
    const token = hashParams.get('token');
    
    if (token) {
      // Store token in localStorage to persist
      localStorage.setItem('authToken', token);
      // Clear the hash from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  
  // DEBUG: Show alert on first render
  useEffect(() => {
    console.log('App mounted, authenticated:', authenticated);
  }, []);
  
  console.log('App rendering, state:', { authenticated, loading, hasTrack: !!track });

  // Clear the #_=_ fragment that Spotify adds
  useEffect(() => {
    if (window.location.hash === '#_=_') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Check for error from redirect
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const errorParam = urlParams.get('error');
      if (errorParam) {
        setError(decodeURIComponent(errorParam));
      }
    } catch (err) {
      console.error('URL params parse error:', err);
    }
    
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check for token in localStorage first (bypasses Chrome bounce tracking)
      const storedToken = localStorage.getItem('authToken');
      
      const endpoint = storedToken ? `${API_BASE}/api/auth/verify-token` : `${API_BASE}/api/auth/me`;
      const headers: Record<string, string> = storedToken 
        ? { 'Authorization': `Bearer ${storedToken}` }
        : {};
      
      const response = await fetch(endpoint, {
        credentials: 'include',
        headers,
      });
      
      setAuthenticated(response.ok);
      if (response.ok) {
        fetchTrack();
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setAuthenticated(false);
    }
  };

  const fetchTrack = async () => {
    setLoading(true);
    try {
      const storedToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = storedToken 
        ? { 'Authorization': `Bearer ${storedToken}` }
        : {};
      
      const response = await fetch(`${API_BASE}/api/tracks/next`, {
        credentials: 'include',
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setTrack(data.tracks?.[0] ?? null);
      } else {
        console.log('Fetch track not ok:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch track:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!track) return;

    try {
      const storedToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = storedToken 
        ? { 'Authorization': `Bearer ${storedToken}` }
        : {};

      await fetch(`${API_BASE}/api/swipes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...headers,
        },
        credentials: 'include',
        body: JSON.stringify({ trackId: track.id, direction }),
      });

      await fetchTrack();
    } catch (err) {
      console.error('Failed to record swipe:', err);
    }
  };

  const handleLogin = () => {
    console.log('Login button clicked');
    window.location.href = `${API_BASE}/api/auth/login`;
  };

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-500 to-black">
        <div className="text-center">
          <h1 className="mb-8 text-6xl font-bold text-white">Sptinder</h1>
          <p className="mb-6 text-xl text-gray-200">Swipe to discover your next favorite track</p>
          {error && (
            <p className="mb-4 text-red-400 text-sm max-w-sm">
              Error: {error}
            </p>
          )}
          <button
            onClick={handleLogin}
            className="rounded-full bg-green-500 px-8 py-3 text-lg font-semibold text-white transition hover:bg-green-600"
          >
            Login with Spotify
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent"></div>
          <p className="text-gray-600">Loading your next track...</p>
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">No tracks available. Try again later.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-lg bg-white p-6 shadow-lg">
          {track.imageUrl && (
            <img
              src={track.imageUrl}
              alt={track.album ?? track.name}
              className="mb-4 w-full rounded-lg"
            />
          )}
          <h2 className="mb-2 text-2xl font-bold">{track.name}</h2>
          <p className="mb-4 text-gray-600">{track.artist}</p>
          {track.album && <p className="mb-2 text-sm text-gray-500">{track.album}</p>}
          {track.previewUrl ? (
            <audio controls src={track.previewUrl} className="mb-4 w-full" />
          ) : (
            <p className="mb-4 text-sm text-gray-400">Preview not available</p>
          )}
          <div className="flex gap-4">
            <button
              onClick={() => handleSwipe('left')}
              className="flex-1 rounded-lg bg-red-500 py-3 font-semibold text-white transition hover:bg-red-600"
            >
              Skip
            </button>
            <button
              onClick={() => handleSwipe('right')}
              className="flex-1 rounded-lg bg-green-500 py-3 font-semibold text-white transition hover:bg-green-600"
            >
              Keep
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;