const pool    = require('../db/pool');
const bcrypt  = require('bcrypt');

// ── Consulta base para SELECT de alumnos ─────────────────────────────────────
const BASE_QUERY = `
  SELECT a.*, c.color AS cinta_color, c.nombre_grado,
         r.nombre AS responsable_nombre, r.telefono AS responsable_tel
  FROM alumnos a
  JOIN cintas c ON c.id_cinta = a.id_cinta_actual
  JOIN responsables r ON r.num_control = a.num_control_responsable`;

// Devuelve solo num_control y nombre (ruta pública para el login del frontend)
async function getPublico() {
  const { rows } = await pool.query(
    `SELECT a.num_control, a.nombre FROM alumnos a ORDER BY a.nombre`
  );
  return rows;
}

// Devuelve todos los alumnos (admin/instructor) o solo los del responsable
async function getAll(user) {
  if (user.rol === 'responsable') {
    const { rows } = await pool.query(
      BASE_QUERY + ` WHERE a.num_control_responsable = $1 ORDER BY a.nombre`,
      [user.num_control_responsable]
    );
    return rows;
  }
  const { rows } = await pool.query(BASE_QUERY + ` ORDER BY a.nombre`);
  return rows;
}

// Devuelve un alumno por su num_control
async function getById(id) {
  const { rows } = await pool.query(
    BASE_QUERY + ` WHERE a.num_control = $1`, [id]
  );
  return rows[0] || null;
}

// Crea alumno simple (solo los campos básicos)
async function create({ num_control, nombre, fecha_nacimiento, id_cinta_actual, num_control_responsable }) {
  const { rows } = await pool.query(
    `INSERT INTO alumnos (num_control, nombre, fecha_nacimiento, id_cinta_actual, num_control_responsable)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [num_control, nombre, fecha_nacimiento, id_cinta_actual, num_control_responsable]
  );
  return rows[0];
}

// Registro completo: crea responsable + alumno + usuario en una sola transacción
async function registroCompleto(data) {
  const {
    num_control, nombre, fecha_nacimiento, id_cinta_actual,
    responsable_nombre, responsable_telefono, responsable_direccion,
    username, password,
    email, direccion, tipo_sangre,
    contacto_emergencia, tel_emergencia, notas_medicas
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resp_id = `RESP-${num_control}`;
    await client.query(
      `INSERT INTO responsables (num_control, nombre, telefono, direccion)
       VALUES ($1, $2, $3, $4) ON CONFLICT (num_control) DO NOTHING`,
      [resp_id, responsable_nombre, responsable_telefono || '', responsable_direccion || '']
    );

    const { rows: alumnoRows } = await client.query(
      `INSERT INTO alumnos
         (num_control, nombre, fecha_nacimiento, id_cinta_actual, num_control_responsable,
          email, direccion, tipo_sangre, contacto_emergencia, tel_emergencia, notas_medicas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [num_control, nombre, fecha_nacimiento, id_cinta_actual || 1, resp_id,
       email || null, direccion || null, tipo_sangre || null,
       contacto_emergencia || null, tel_emergencia || null, notas_medicas || null]
    );

    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO usuarios (username, password, rol, num_control_responsable)
       VALUES ($1, $2, 'responsable', $3)
       ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password`,
      [username, hash, resp_id]
    );

    await client.query('COMMIT');
    return alumnoRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Actualiza datos editables de un alumno
async function update(id, data) {
  const {
    nombre, fecha_nacimiento, id_cinta_actual,
    email, direccion, tipo_sangre,
    contacto_emergencia, tel_emergencia, notas_medicas
  } = data;

  const { rows } = await pool.query(
    `UPDATE alumnos
     SET nombre=$1, fecha_nacimiento=$2, id_cinta_actual=$3,
         email=$4, direccion=$5, tipo_sangre=$6,
         contacto_emergencia=$7, tel_emergencia=$8, notas_medicas=$9
     WHERE num_control=$10 RETURNING *`,
    [nombre, fecha_nacimiento, id_cinta_actual,
     email || null, direccion || null, tipo_sangre || null,
     contacto_emergencia || null, tel_emergencia || null, notas_medicas || null,
     id]
  );
  return rows[0] || null;
}

// Elimina alumno + responsable + usuario (si es el único alumno) en transacción
async function remove(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: alumnoRows } = await client.query(
      `SELECT num_control_responsable FROM alumnos WHERE num_control = $1`, [id]
    );
    if (!alumnoRows.length) {
      await client.query('ROLLBACK');
      return false; // no encontrado
    }
    const resp_id = alumnoRows[0].num_control_responsable;

    await client.query('DELETE FROM alumnos WHERE num_control = $1', [id]);

    const { rows: otros } = await client.query(
      `SELECT 1 FROM alumnos WHERE num_control_responsable = $1 LIMIT 1`, [resp_id]
    );
    if (otros.length === 0) {
      await client.query(`DELETE FROM usuarios WHERE num_control_responsable = $1`, [resp_id]);
      await client.query(`DELETE FROM responsables WHERE num_control = $1`, [resp_id]);
    }

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getPublico, getAll, getById, create, registroCompleto, update, remove };
