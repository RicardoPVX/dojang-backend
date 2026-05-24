const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/equipo — incluye préstamos activos
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM equipo ORDER BY descripcion');
    const { rows: prestamos } = await pool.query(`
      SELECT p.*, a.nombre AS alumno_nombre
      FROM prestamos_equipo p
      JOIN alumnos a ON a.num_control = p.num_control_alumno
      ORDER BY p.fecha_prestamo DESC
    `);
    // Adjuntar préstamos a cada artículo
    const result = rows.map(e => ({
      ...e,
      prestamos: prestamos.filter(p => p.id_articulo === e.id_articulo)
    }));
    res.json(result);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});

// POST /api/equipo — agregar artículo
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
    res.status(201).json({...rows[0], prestamos:[]});
  } catch(err) { res.status(500).json({ error: 'Error al agregar artículo' }); }
});

// PUT /api/equipo/:id — actualizar artículo
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
  } catch(err) { res.status(500).json({ error: 'Error al actualizar artículo' }); }
});

// POST /api/equipo/:id/prestar — prestar unidad a un alumno
router.post('/:id/prestar', auth, allow('admin','instructor'), async (req, res) => {
  const { num_control_alumno } = req.body;
  if (!num_control_alumno)
    return res.status(400).json({ error: 'num_control_alumno es obligatorio' });
  try {
    // Verificar stock disponible
    const { rows: eq } = await pool.query(
      'SELECT stock FROM equipo WHERE id_articulo=$1', [req.params.id]
    );
    if (!eq.length) return res.status(404).json({ error: 'Artículo no encontrado' });
    if (eq[0].stock <= 0) return res.status(400).json({ error: 'Sin stock disponible' });

    // Registrar préstamo y bajar stock
    const { rows } = await pool.query(
      `INSERT INTO prestamos_equipo (id_articulo, num_control_alumno)
       VALUES ($1,$2) RETURNING *`,
      [req.params.id, num_control_alumno]
    );
    await pool.query(
      'UPDATE equipo SET stock = stock - 1 WHERE id_articulo=$1',
      [req.params.id]
    );
    res.status(201).json(rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar préstamo' });
  }
});

// DELETE /api/equipo/prestamos/:idPrestamo — devolver equipo
router.delete('/prestamos/:idPrestamo', auth, allow('admin','instructor'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM prestamos_equipo WHERE id_prestamo=$1 RETURNING *',
      [req.params.idPrestamo]
    );
    if (!rows.length) return res.status(404).json({ error: 'Préstamo no encontrado' });
    // Devolver stock
    await pool.query(
      'UPDATE equipo SET stock = stock + 1 WHERE id_articulo=$1',
      [rows[0].id_articulo]
    );
    res.json({ mensaje: 'Equipo devuelto', id_articulo: rows[0].id_articulo });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al devolver equipo' });
  }
});

// DELETE /api/equipo/:id — eliminar artículo
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM prestamos_equipo WHERE id_articulo=$1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM equipo WHERE id_articulo=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json({ mensaje: 'Artículo eliminado' });
  } catch(err) { res.status(500).json({ error: 'Error al eliminar artículo' }); }
});

module.exports = router;
