import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://sptinder:password@localhost:5432/sptinder'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key'
  }
};