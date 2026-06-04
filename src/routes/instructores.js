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
  const id = req.params.id;
  if (String(req.user.id_instructor) === String(id))
    return res.status(400).json({ error: 'No puedes eliminar tu propio perfil' });
  if (String(id) === '1')
    return res.status(400).json({ error: 'No se puede eliminar al maestro principal' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Buscar dinámicamente TODAS las tablas que referencian instructores(id_instructor),
    // incluso las que no están en schema.sql (evita el error 500 por FK).
    const fks = await client.query(`
      SELECT tc.table_name, kcu.column_name, col.is_nullable
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      JOIN information_schema.columns col
        ON col.table_name = tc.table_name AND col.column_name = kcu.column_name
        AND col.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'instructores'
        AND ccu.column_name = 'id_instructor'
    `);

    for (const fk of fks.rows) {
      const t = fk.table_name, c = fk.column_name;
      if (t === 'usuarios') {
        // eliminar la cuenta de acceso del maestro
        await client.query(`DELETE FROM usuarios WHERE ${c} = $1`, [id]);
      } else if (fk.is_nullable === 'YES') {
        // columnas opcionales: dejarlas en NULL
        await client.query(`UPDATE ${t} SET ${c} = NULL WHERE ${c} = $1`, [id]);
      } else {
        // columnas obligatorias (clases, avances...): reasignar al maestro principal (id 1)
        await client.query(`UPDATE ${t} SET ${c} = 1 WHERE ${c} = $1`, [id]);
      }
    }

    const { rowCount } = await client.query('DELETE FROM instructores WHERE id_instructor = $1', [id]);
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No encontrado' });
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Instructor eliminado' });
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar instructor:', err);
    res.status(500).json({ error: 'Error al eliminar', detalle: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
