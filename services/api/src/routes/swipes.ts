import { Router } from 'express';
import { swipesController } from '../controllers/swipesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Record a swipe
router.post('/', authenticateToken, swipesController.recordSwipe);

// Get user's swipe history
router.get('/history', authenticateToken, swipesController.getSwipeHistory);

export default router;