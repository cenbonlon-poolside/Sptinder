"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const swipesController_1 = require("../controllers/swipesController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Record a swipe
router.post('/', auth_1.authenticateToken, swipesController_1.swipesController.recordSwipe);
// Get user's swipe history
router.get('/history', auth_1.authenticateToken, swipesController_1.swipesController.getSwipeHistory);
exports.default = router;
//# sourceMappingURL=swipes.js.map