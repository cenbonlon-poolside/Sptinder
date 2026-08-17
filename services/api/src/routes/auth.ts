import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Spotify OAuth routes
router.get('/spotify', authController.initiateSpotifyAuth);
router.post('/exchange', authController.exchangeCode);
router.post('/refresh', authenticateToken, authController.refreshToken);
router.post('/logout', authenticateToken, authController.logout);

// Get current user profile
router.get('/me', authenticateToken, authController.getCurrentUser);

export default router;