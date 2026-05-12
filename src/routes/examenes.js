const router = require('express').Router();
const { auth, allow } = require('../middleware/auth');
const ctrl   = require('../controllers/examenes.controller');

router.get('/',    auth,                               ctrl.getExamenes);
router.post('/',   auth, allow('admin','instructor'),   ctrl.crearExamen);
router.put('/:id', auth, allow('admin','instructor'),   ctrl.actualizarExamen);

module.exports = router;
