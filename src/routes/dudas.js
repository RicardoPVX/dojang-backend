const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// POST /api/dudas — cualquier usuario autenticado (alumno/tutor) puede enviar una duda
router.post('/', auth, async (req, res) => {
  const { mensaje } = req.body;
  if (!mensaje || !mensaje.trim())
    return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  try {
    const remitente   = req.body.remitente   || req.user.username || 'Usuario';
    const num_control = req.body.num_control || req.user.num_control_responsable || null;
    const { rows } = await pool.query(
      `INSERT INTO dudas (remitente, num_control, mensaje) VALUES ($1,$2,$3) RETURNING *`,
      [remitente, num_control, mensaje.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error al guardar duda:', err);
    res.status(500).json({ error: 'Error al enviar la duda' });
  }
});

// GET /api/dudas — buzón (solo admin)
router.get('/', auth, allow('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM dudas ORDER BY fecha DESC`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dudas' });
  }
});

// PUT /api/dudas/:id/leido — marcar como leída
router.put('/:id/leido', auth, allow('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE dudas SET leido = true WHERE id_duda = $1 RETURNING *`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// DELETE /api/dudas/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    await pool.query(`DELETE FROM dudas WHERE id_duda = $1`, [req.params.id]);
    res.json({ mensaje: 'Eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

module.exports = router;
