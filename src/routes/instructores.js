const router  = require('express').Router();
const pool    = require('../db/pool');
const bcrypt  = require('bcrypt');
const { auth, allow } = require('../middleware/auth');

// GET /api/instructores
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, u.username, u.rol
      FROM instructores i
      LEFT JOIN usuarios u ON u.id_instructor = i.id_instructor
      ORDER BY i.nombre
    `);
    res.json(rows);
  } catch(err) {
    res.status(500).json({ error: 'Error al obtener instructores' });
  }
});

// PUT /api/instructores/mi-perfil — actualizar perfil propio
router.put('/mi-perfil', auth, async (req, res) => {
  const { nombre, cargo, grado_cinta, email, telefono } = req.body;
  if (!req.user.id_instructor)
    return res.status(400).json({ error: 'Sin perfil de instructor' });
  try {
    const { rows } = await pool.query(
      `UPDATE instructores SET nombre=$1, cargo=$2, grado_cinta=$3,
       email=COALESCE($4,email), telefono=COALESCE($5,telefono)
       WHERE id_instructor=$6 RETURNING *`,
      [nombre, cargo||null, grado_cinta||null, email||null, telefono||null,
       req.user.id_instructor]
    );
    if (nombre) await pool.query(
      'UPDATE usuarios SET nombre=$1 WHERE id_usuario=$2',
      [nombre, req.user.id_usuario]
    );
    res.json(rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// POST /api/instructores — dar de alta nuevo maestro
router.post('/', auth, allow('admin'), async (req, res) => {
  const { nombre, cargo, grado_cinta, email, telefono, username, password } = req.body;
  if (!nombre || !username || !password)
    return res.status(400).json({ error: 'Nombre, usuario y contraseña son obligatorios' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO instructores (nombre, cargo, grado_cinta, email, telefono)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, cargo||null, grado_cinta||null, email||null, telefono||null]
    );
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO usuarios (username, password, rol, id_instructor, nombre)
       VALUES ($1,$2,'admin',$3,$4)`,
      [username, hash, rows[0].id_instructor, nombre]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch(err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'El usuario ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error al registrar maestro' });
  } finally { client.release(); }
});

// PUT /api/instructores/:id
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { nombre, cargo, grado_cinta, email, telefono } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE instructores SET nombre=$1, cargo=$2, grado_cinta=$3, email=$4, telefono=$5
       WHERE id_instructor=$6 RETURNING *`,
      [nombre, cargo||null, grado_cinta||null, email||null, telefono||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Instructor no encontrado' });
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: 'Error al actualizar' }); }
});

// DELETE /api/instructores/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  if (String(req.user.id_instructor) === String(req.params.id))
    return res.status(400).json({ error: 'No puedes eliminar tu propio perfil' });
  try {
    await pool.query('UPDATE clases SET id_instructor=1 WHERE id_instructor=$1', [req.params.id]);
    await pool.query('UPDATE usuarios SET id_instructor=NULL WHERE id_instructor=$1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM instructores WHERE id_instructor=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'No encontrado' });
    res.json({ mensaje: 'Instructor eliminado' });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

module.exports = router;
