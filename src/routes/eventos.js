const router = require('express').Router();
const { auth, allow } = require('../middleware/auth');
const ctrl   = require('../controllers/eventos.controller');

router.get('/',       auth,                               ctrl.getEventos);
router.post('/',      auth, allow('admin','instructor'),   ctrl.crearEvento);
router.put('/:id',    auth, allow('admin','instructor'),   ctrl.actualizarEvento);
router.delete('/:id', auth, allow('admin','instructor'),   ctrl.eliminarEvento);

module.exports = router;
