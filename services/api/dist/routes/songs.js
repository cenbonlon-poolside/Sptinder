"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const songsController_1 = require("../controllers/songsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get songs for swiping
router.get('/', auth_1.authenticateToken, songsController_1.songsController.getSongsForSwiping);
// Get song details
router.get('/:songId', auth_1.authenticateToken, songsController_1.songsController.getSongDetails);
// Search songs
router.get('/search/:query', auth_1.authenticateToken, songsController_1.songsController.searchSongs);
exports.default = router;
//# sourceMappingURL=songs.js.map