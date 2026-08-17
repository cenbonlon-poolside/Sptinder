"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const matchesController_1 = require("../controllers/matchesController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user's matches
router.get('/', auth_1.authenticateToken, matchesController_1.matchesController.getMatches);
// Get match details
router.get('/:matchId', auth_1.authenticateToken, matchesController_1.matchesController.getMatchDetails);
// Get chat messages for a match
router.get('/:matchId/messages', auth_1.authenticateToken, matchesController_1.matchesController.getChatMessages);
// Send a message in a match
router.post('/:matchId/messages', auth_1.authenticateToken, matchesController_1.matchesController.sendMessage);
exports.default = router;
//# sourceMappingURL=matches.js.map