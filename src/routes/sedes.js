const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/sedes — listar todas las sedes
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM sedes ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sedes' });
  }
});

// GET /api/sedes/:id — obtener una sede con sus torneos
router.get('/:id', auth, async (req, res) => {
  try {
    const sede = await pool.query(
      `SELECT * FROM sedes WHERE id_sede=$1`,
      [req.params.id]
    );
    if (!sede.rows.length)
      return res.status(404).json({ error: 'Sede no encontrada' });

    const torneos = await pool.query(
      `SELECT id_torneo, nombre_torneo, fecha FROM torneos
       WHERE id_sede=$1 ORDER BY fecha ASC`,
      [req.params.id]
    );

    res.json({ ...sede.rows[0], torneos: torneos.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sede' });
  }
});

// POST /api/sedes — crear sede
router.post('/', auth, allow('admin'), async (req, res) => {
  const { nombre, ciudad, estado, direccion, capacidad } = req.body;
  if (!nombre)
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO sedes (nombre, ciudad, estado, direccion, capacidad, num_visitantes)
       VALUES ($1,$2,$3,$4,$5,0) RETURNING *`,
      [nombre, ciudad || null, estado || null, direccion || null, capacidad || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear sede' });
  }
});

// PUT /api/sedes/:id — editar sede
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { nombre, ciudad, estado, direccion, capacidad } = req.body;
  if (!nombre)
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const { rows } = await pool.query(
      `UPDATE sedes SET nombre=$1, ciudad=$2, estado=$3, direccion=$4, capacidad=$5
       WHERE id_sede=$6 RETURNING *`,
      [nombre, ciudad || null, estado || null, direccion || null, capacidad || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sede no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar sede' });
  }
});

// PATCH /api/sedes/:id/visitantes — actualizar visitantes
router.patch('/:id/visitantes', auth, allow('admin','instructor'), async (req, res) => {
  const { num_visitantes } = req.body;
  if (num_visitantes === undefined || num_visitantes < 0)
    return res.status(400).json({ error: 'num_visitantes debe ser un número positivo' });
  try {
    const { rows } = await pool.query(
      `UPDATE sedes SET num_visitantes=$1 WHERE id_sede=$2 RETURNING *`,
      [num_visitantes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sede no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar visitantes' });
  }
});

// DELETE /api/sedes/:id — eliminar sede (solo si no tiene torneos)
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    const torneos = await pool.query(
      `SELECT COUNT(*) FROM torneos WHERE id_sede=$1`, [req.params.id]
    );
    if (parseInt(torneos.rows[0].count) > 0)
      return res.status(400).json({ error: 'No se puede eliminar: la sede tiene torneos asociados' });

    const { rowCount } = await pool.query(
      'DELETE FROM sedes WHERE id_sede=$1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Sede no encontrada' });
    res.json({ mensaje: 'Sede eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar sede' });
  }
});

module.exports = router;
