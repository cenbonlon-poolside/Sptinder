import { Router } from 'express';
import { matchesController } from '../controllers/matchesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get user's matches
router.get('/', authenticateToken, matchesController.getMatches);

// Get match details
router.get('/:matchId', authenticateToken, matchesController.getMatchDetails);

// Get chat messages for a match
router.get('/:matchId/messages', authenticateToken, matchesController.getChatMessages);

// Send a message in a match
router.post('/:matchId/messages', authenticateToken, matchesController.sendMessage);

export default router;