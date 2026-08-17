"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usersController_1 = require("../controllers/usersController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user profile
router.get('/profile', auth_1.authenticateToken, usersController_1.usersController.getProfile);
// Update user profile
router.put('/profile', auth_1.authenticateToken, usersController_1.usersController.updateProfile);
// Get user's playlists
router.get('/playlists', auth_1.authenticateToken, usersController_1.usersController.getPlaylists);
// Create collaborative playlist
router.post('/playlists', auth_1.authenticateToken, usersController_1.usersController.createPlaylist);
exports.default = router;
//# sourceMappingURL=users.js.map