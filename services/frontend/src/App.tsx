import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Swipe from './pages/Swipe';
import Matches from './pages/Matches';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Layout from './components/Layout';

const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Routes>
      {!user ? (
        <>
          <Route path="/auth/callback" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
        </>
      ) : (
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/swipe" replace />} />
          <Route path="swipe" element={<Swipe />} />
          <Route path="matches" element={<Matches />} />
          <Route path="chat/:matchId" element={<Chat />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/swipe" replace />} />
        </Route>
      )}
    </Routes>
  );
};

export default App;