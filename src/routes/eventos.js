const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/eventos
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM eventos ORDER BY fecha ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// POST /api/eventos
router.post('/', auth, allow('admin'), async (req, res) => {
  const { titulo, tipo, fecha, lugar, descripcion } = req.body;
  if (!titulo || !fecha)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO eventos (titulo, tipo, fecha, lugar, descripcion)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [titulo, tipo||'especial', fecha, lugar||null, descripcion||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

// PUT /api/eventos/:id
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { titulo, tipo, fecha, lugar, descripcion } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE eventos SET titulo=$1, tipo=$2, fecha=$3, lugar=$4, descripcion=$5
       WHERE id_evento=$6 RETURNING *`,
      [titulo, tipo||'especial', fecha, lugar||null, descripcion||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
});

// DELETE /api/eventos/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM eventos WHERE id_evento=$1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json({ mensaje: 'Evento eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
});

module.exports = router;
