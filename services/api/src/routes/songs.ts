import { Router } from 'express';
import { songsController } from '../controllers/songsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get songs for swiping
router.get('/', authenticateToken, songsController.getSongsForSwiping);

// Get song details
router.get('/:songId', authenticateToken, songsController.getSongDetails);

// Search songs
router.get('/search/:query', authenticateToken, songsController.searchSongs);

export default router;