const router  = require('express').Router();
const pool    = require('../db/pool');
const bcrypt  = require('bcrypt');
const { auth, allow } = require('../middleware/auth');

// GET /api/instructores/publico — sin token, para que el login reconozca maestros
router.get('/publico', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.username, i.nombre
      FROM usuarios u
      JOIN instructores i ON i.id_instructor = u.id_instructor
      WHERE u.rol = 'instructor'
      ORDER BY i.nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

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
       VALUES ($1,$2,'instructor',$3,$4)`,
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
  if (String(req.params.id) === '1')
    return res.status(400).json({ error: 'No se puede eliminar al maestro principal' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Reasignar clases y avances al maestro principal (id 1) para conservar el historial
    await client.query('UPDATE clases  SET id_instructor=1 WHERE id_instructor=$1', [req.params.id]);
    await client.query('UPDATE avances SET id_instructor=1 WHERE id_instructor=$1', [req.params.id]);

    // Borrar su cuenta de acceso (antes solo se desvinculaba y quedaba huérfana)
    await client.query('DELETE FROM usuarios WHERE id_instructor=$1', [req.params.id]);

    // Borrar el instructor
    const { rowCount } = await client.query('DELETE FROM instructores WHERE id_instructor=$1', [req.params.id]);
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No encontrado' });
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Instructor eliminado' });
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar instructor:', err);
    res.status(500).json({ error: 'Error al eliminar' });
  } finally {
    client.release();
  }
});

module.exports = router;
