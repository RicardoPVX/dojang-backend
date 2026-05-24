const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/equipo
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM equipo ORDER BY descripcion');
    res.json(rows);
  } catch(err) {
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});

// POST /api/equipo
router.post('/', auth, allow('admin'), async (req, res) => {
  const { descripcion, talla_modelo, precio_unitario, stock=0, stock_minimo=2 } = req.body;
  if (!descripcion || precio_unitario===undefined)
    return res.status(400).json({ error: 'Descripción y precio son obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO equipo (descripcion, talla_modelo, precio_unitario, stock, stock_minimo)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [descripcion, talla_modelo||null, precio_unitario, stock, stock_minimo]
    );
    res.status(201).json(rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Error al agregar artículo' });
  }
});

// PUT /api/equipo/:id
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { descripcion, talla_modelo, precio_unitario, stock, stock_minimo } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE equipo SET descripcion=$1, talla_modelo=$2, precio_unitario=$3,
       stock=$4, stock_minimo=$5 WHERE id_articulo=$6 RETURNING *`,
      [descripcion, talla_modelo||null, precio_unitario, stock, stock_minimo, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json(rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Error al actualizar artículo' });
  }
});

// PUT /api/equipo/:id/prestar — asignar equipo a alumno
router.put('/:id/prestar', auth, allow('admin','instructor'), async (req, res) => {
  const { num_control_alumno } = req.body;
  if (!num_control_alumno)
    return res.status(400).json({ error: 'num_control_alumno es obligatorio' });
  try {
    const { rows } = await pool.query(
      `UPDATE equipo SET num_control_alumno_prestamo=$1, fecha_prestamo=CURRENT_DATE
       WHERE id_articulo=$2 RETURNING *`,
      [num_control_alumno, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json(rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al prestar equipo' });
  }
});

// PUT /api/equipo/:id/liberar — liberar equipo
router.put('/:id/liberar', auth, allow('admin','instructor'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE equipo SET num_control_alumno_prestamo=NULL, fecha_prestamo=NULL
       WHERE id_articulo=$1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json(rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Error al liberar equipo' });
  }
});

// DELETE /api/equipo/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM equipo WHERE id_articulo=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json({ mensaje: 'Artículo eliminado' });
  } catch(err) {
    res.status(500).json({ error: 'Error al eliminar artículo' });
  }
});

module.exports = router;
