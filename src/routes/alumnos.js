const router = require('express').Router();
const { auth, allow } = require('../middleware/auth');
const ctrl   = require('../controllers/alumnos.controller');

// Rutas sin parámetro dinámico DEBEN ir antes de /:id para que Express no las capture
router.post('/registro-completo', auth, allow('admin','instructor'), ctrl.registroCompleto);

router.get('/',    auth,                                        ctrl.getAlumnos);
router.get('/:id', auth,                                        ctrl.getAlumno);
router.post('/',   auth, allow('admin','instructor'),            ctrl.crearAlumno);
router.put('/:id', auth, allow('admin','instructor'),            ctrl.actualizarAlumno);
router.put('/:id/personal', auth,                               ctrl.actualizarPersonal);
router.delete('/:id', auth, allow('admin'),                      ctrl.eliminarAlumno);

module.exports = router;
