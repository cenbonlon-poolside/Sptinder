import { Router } from 'express';
import { usersController } from '../controllers/usersController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get user profile
router.get('/profile', authenticateToken, usersController.getProfile);

// Update user profile
router.put('/profile', authenticateToken, usersController.updateProfile);

// Get user's playlists
router.get('/playlists', authenticateToken, usersController.getPlaylists);

// Create collaborative playlist
router.post('/playlists', authenticateToken, usersController.createPlaylist);

export default router;