const router = require('express').Router();
const { auth, allow } = require('../middleware/auth');
const ctrl   = require('../controllers/inventario.controller');

router.get('/',    auth,                               ctrl.getInventario);
router.post('/',   auth, allow('admin'),               ctrl.crearArticulo);
router.put('/:id', auth, allow('admin','instructor'),   ctrl.actualizarArticulo);
router.delete('/:id', auth, allow('admin'),            ctrl.eliminarArticulo);

module.exports = router;
