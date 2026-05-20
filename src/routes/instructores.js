const router  = require('express').Router();
const pool    = require('../db/pool');
const bcrypt  = require('bcrypt');
const { auth, allow } = require('../middleware/auth');

// GET /api/instructores
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.username
       FROM instructores i
       LEFT JOIN usuarios u ON u.id_instructor = i.id_instructor
       ORDER BY i.id_instructor`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener instructores' });
  }
});

// GET /api/instructores/mi-perfil — perfil del instructor logueado
router.get('/mi-perfil', auth, async (req, res) => {
  if (!req.user.id_instructor)
    return res.status(404).json({ error: 'No vinculado a instructor' });
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.username
       FROM instructores i
       LEFT JOIN usuarios u ON u.id_instructor = i.id_instructor
       WHERE i.id_instructor = $1`, [req.user.id_instructor]
    );
    if (!rows.length) return res.status(404).json({ error: 'Instructor no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/instructores/mi-perfil — actualizar mi propio perfil
router.put('/mi-perfil', auth, async (req, res) => {
  if (!req.user.id_instructor)
    return res.status(403).json({ error: 'No vinculado a instructor' });
  const { nombre, cargo, grado_cinta, email, telefono } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE instructores SET nombre=$1, cargo=$2, grado_cinta=$3, email=$4, telefono=$5
       WHERE id_instructor=$6 RETURNING *`,
      [nombre, cargo, grado_cinta, email || null, telefono || null, req.user.id_instructor]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// POST /api/instructores — dar de alta nuevo instructor + usuario
router.post('/', auth, allow('admin'), async (req, res) => {
  const { nombre, cargo, grado_cinta, email, telefono, username, password } = req.body;
  if (!nombre || !username || !password)
    return res.status(400).json({ error: 'Faltan nombre, usuario o contraseña' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: instRows } = await client.query(
      `INSERT INTO instructores (nombre, cargo, grado_cinta, email, telefono)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, cargo || 'Instructor', grado_cinta || 'Blanco', email || null, telefono || null]
    );
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO usuarios (username, password, rol, id_instructor)
       VALUES ($1,$2,'instructor',$3)`,
      [username, hash, instRows[0].id_instructor]
    );
    await client.query('COMMIT');
    res.status(201).json(instRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Usuario ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error al registrar instructor' });
  } finally {
    client.release();
  }
});

// PUT /api/instructores/:id — editar instructor
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { nombre, cargo, grado_cinta, email, telefono } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE instructores SET nombre=$1, cargo=$2, grado_cinta=$3, email=$4, telefono=$5
       WHERE id_instructor=$6 RETURNING *`,
      [nombre, cargo, grado_cinta, email || null, telefono || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// DELETE /api/instructores/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    // Desvincular usuario
    await pool.query('UPDATE usuarios SET id_instructor=NULL WHERE id_instructor=$1', [req.params.id]);
    // Desvincular clases
    await pool.query('UPDATE clases SET id_instructor=NULL WHERE id_instructor=$1', [req.params.id]);
    await pool.query('DELETE FROM instructores WHERE id_instructor=$1', [req.params.id]);
    res.json({ mensaje: 'Instructor eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

module.exports = router;
