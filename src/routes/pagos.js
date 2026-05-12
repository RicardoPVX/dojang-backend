const router = require('express').Router();
const { auth, allow } = require('../middleware/auth');
const ctrl   = require('../controllers/pagos.controller');

router.get('/',               auth,                    ctrl.getPagos);
router.post('/',              auth, allow('admin','instructor'), ctrl.crearPago);
router.put('/:id/abonar',     auth, allow('admin'),    ctrl.abonar);

module.exports = router;
