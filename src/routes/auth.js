const router = require('express').Router();
const { auth } = require('../middleware/auth');
const ctrl    = require('../controllers/auth.controller');
const { rateLimit } = require('../middleware/rateLimit');

// Máx. 10 intentos de login por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
});

router.post('/login',        loginLimiter, ctrl.login);
router.post('/cambiar-pass', auth, ctrl.cambiarPass);

module.exports = router;
