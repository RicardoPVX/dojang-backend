const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/torneos
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM torneos ORDER BY fecha ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener torneos' });
  }
});

// POST /api/torneos — registrar torneo futuro
router.post('/', auth, allow('admin'), async (req, res) => {
  const { nombre_torneo, sede, fecha } = req.body;
  if (!nombre_torneo || !fecha)
    return res.status(400).json({ error: 'Nombre y fecha son obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO torneos (nombre_torneo, sede, fecha, id_pago, num_control_alumno)
       VALUES ($1,$2,$3,NULL,NULL) RETURNING *`,
      [nombre_torneo, sede || null, fecha]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar torneo' });
  }
});

// PUT /api/torneos/:id
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { nombre_torneo, sede, fecha } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE torneos SET nombre_torneo=$1, sede=$2, fecha=$3
       WHERE id_torneo=$4 RETURNING *`,
      [nombre_torneo, sede || null, fecha, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Torneo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar torneo' });
  }
});

// DELETE /api/torneos/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM torneos WHERE id_torneo=$1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Torneo no encontrado' });
    res.json({ mensaje: 'Torneo eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar torneo' });
  }
});

module.exports = router;
