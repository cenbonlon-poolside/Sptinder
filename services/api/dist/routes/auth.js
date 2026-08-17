"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Spotify OAuth routes
router.get('/spotify', authController_1.authController.initiateSpotifyAuth);
router.post('/exchange', authController_1.authController.exchangeCode);
router.post('/refresh', auth_1.authenticateToken, authController_1.authController.refreshToken);
router.post('/logout', auth_1.authenticateToken, authController_1.authController.logout);
// Get current user profile
router.get('/me', auth_1.authenticateToken, authController_1.authController.getCurrentUser);
exports.default = router;
//# sourceMappingURL=auth.js.map