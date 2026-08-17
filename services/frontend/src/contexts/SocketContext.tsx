import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketContextType } from '../types';

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connect = () => {
    if (socketRef.current?.connected) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    socketRef.current = io(process.env.REACT_APP_REALTIME_URL || 'ws://localhost:4001', {
      auth: {
        token
      }
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to real-time server');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from real-time server');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, []);

  // Reconnect when token changes
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token && !isConnected) {
      connect();
    } else if (!token && isConnected) {
      disconnect();
    }
  }, [localStorage.getItem('authToken')]);

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};