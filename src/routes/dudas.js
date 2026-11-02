const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');
const { puedeTocarAlumno } = require('../middleware/propiedad');

// POST /api/dudas — cualquier usuario autenticado (alumno/tutor) puede enviar una duda
router.post('/', auth, async (req, res) => {
  const { mensaje } = req.body;
  if (!mensaje || !mensaje.trim())
    return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  try {
    const esResponsable = req.user.rol === 'responsable';
    let remitente = req.body.remitente || req.user.username || 'Usuario';
    // Un responsable no puede firmar dudas a nombre de otra familia
    const num_control = esResponsable
      ? req.user.id_responsable
      : (req.body.num_control || null);
    if (esResponsable) {
      const { rows: tutor } = await pool.query(
        'SELECT nombre FROM responsables WHERE num_control = $1', [req.user.id_responsable]
      );
      if (tutor.length) remitente = tutor[0].nombre;
    }
    const alumno = req.body.num_control_alumno || null;
    if (alumno && !(await puedeTocarAlumno(req.user, alumno)))
      return res.status(404).json({ error: 'Alumno no encontrado' });
    const { rows } = await pool.query(
      `INSERT INTO dudas (remitente, num_control, mensaje, num_control_alumno) VALUES ($1,$2,$3,$4) RETURNING *`,
      [remitente, num_control, mensaje.trim(), alumno]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error al guardar duda:', err);
    res.status(500).json({ error: 'Error al enviar la duda' });
  }
});

// GET /api/dudas — buzón de la escuela; una familia solo ve las suyas
router.get('/', auth, allow('admin','responsable'), async (req, res) => {
  try {
    const esResponsable = req.user.rol === 'responsable';
    const { rows } = await pool.query(
      `SELECT * FROM dudas ${esResponsable ? 'WHERE num_control = $1' : ''} ORDER BY fecha DESC`,
      esResponsable ? [req.user.id_responsable] : []
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dudas' });
  }
});

// PUT /api/dudas/:id/leido — marcar como leída (o devolverla a sin leer con { leido: false })
router.put('/:id/leido', auth, allow('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE dudas SET leido = $1 WHERE id_duda = $2 RETURNING *`,
      [req.body?.leido !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// DELETE /api/dudas/:id — una familia puede retirar la suya mientras la escuela no la lea
router.delete('/:id', auth, allow('admin','responsable'), async (req, res) => {
  try {
    const esResponsable = req.user.rol === 'responsable';
    const { rowCount } = await pool.query(
      `DELETE FROM dudas WHERE id_duda = $1 ${esResponsable ? 'AND num_control = $2 AND leido = false' : ''}`,
      esResponsable ? [req.params.id, req.user.id_responsable] : [req.params.id]
    );
    if (esResponsable && !rowCount) return res.status(404).json({ error: 'No encontrada' });
    res.json({ mensaje: 'Eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

module.exports = router;
