const express = require('express');
const AuthController = require('../controllers/auth.controller');
const GameController = require('../controllers/game.controller');

const router = express.Router();

// Auth routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Game routes
router.post('/save-game', GameController.saveGame);
router.get('/history/:username', GameController.getHistory);

module.exports = router;
