const router = require('express').Router();
const { auth, allow } = require('../middleware/auth');
const ctrl   = require('../controllers/avances.controller');

router.get('/',  auth,                               ctrl.getAvances);
router.post('/', auth, allow('admin','instructor'),   ctrl.crearAvance);

module.exports = router;
