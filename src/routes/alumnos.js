const router  = require('express').Router();
const pool    = require('../db/pool');
const { auth, allow } = require('../middleware/auth');
const { puedeTocarAlumno } = require('../middleware/propiedad');
const { generarPassTemporal } = require('../middleware/passTemporal');

// Un ID nunca se reutiliza: los tutores y pagos de alumnos borrados se conservan como historial,
// y un alumno nuevo con el mismo ID los heredaría
async function siguienteIdLibre(client, solicitado) {
  const m = solicitado.match(/^(.*?)(\d{3})$/);
  const prefijo = m ? m[1] : `${solicitado}-`;
  let n = m ? parseInt(m[2]) : 1;
  for (let i = 0; i < 1000; i++, n++) {
    const id = i === 0 && m ? solicitado : `${prefijo}${String(n).padStart(3, '0')}`;
    const { rows } = await client.query(
      `SELECT 1 FROM alumnos WHERE num_control = $1
       UNION ALL SELECT 1 FROM responsables WHERE num_control = $2
       UNION ALL SELECT 1 FROM usuarios WHERE LOWER(username) = LOWER($1)
       UNION ALL SELECT 1 FROM pagos WHERE num_control_alumno = $1`,
      [id, `RESP-${id}`]
    );
    if (!rows.length) return id;
  }
  throw new Error('Sin IDs disponibles');
}

// Crea tutor + cuenta nuevos y regresa la contraseña temporal (se muestra una sola vez)
async function crearTutor(client, resp_id, username, { nombre, telefono, direccion }) {
  await client.query(
    `INSERT INTO responsables (num_control, nombre, telefono, direccion)
     VALUES ($1, $2, $3, $4)`,
    [resp_id, nombre, telefono || '', direccion || '']
  );
  const bcrypt = require('bcrypt');
  const password_temporal = generarPassTemporal();
  const hash = await bcrypt.hash(password_temporal, 10);
  await client.query(
    `INSERT INTO usuarios (username, password, rol, num_control_responsable, debe_cambiar)
     VALUES ($1, $2, 'responsable', $3, true)`,
    [username, hash, resp_id]
  );
  return password_temporal;
}

// POST /api/alumnos/registro-completo
// El ID final y la contraseña temporal los decide el servidor y se regresan en la respuesta.
// Con num_control_responsable el alumno se agrega a la cuenta de ese tutor, sin crear otra.
router.post('/registro-completo', auth, allow('admin','instructor'), async (req, res) => {
  const { nombre, fecha_nacimiento, id_cinta_actual,
          responsable_nombre, responsable_telefono, responsable_direccion,
          num_control_responsable, parentesco,
          // Nuevos campos del alumno
          email, direccion, tipo_sangre,
          contacto_emergencia, tel_emergencia, notas_medicas } = req.body;

  if (!req.body.num_control || !nombre || !fecha_nacimiento || (!responsable_nombre && !num_control_responsable))
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const num_control = await siguienteIdLibre(client, req.body.num_control);
    let resp_id = num_control_responsable;
    let password_temporal = null;
    if (resp_id) {
      const { rows: cuenta } = await client.query(
        'SELECT 1 FROM usuarios WHERE num_control_responsable = $1', [resp_id]
      );
      if (!cuenta.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Tutor no encontrado' });
      }
    } else {
      resp_id = `RESP-${num_control}`;
      password_temporal = await crearTutor(client, resp_id, num_control, {
        nombre: responsable_nombre, telefono: responsable_telefono, direccion: responsable_direccion
      });
    }

    const { rows: alumnoRows } = await client.query(
      `INSERT INTO alumnos
         (num_control, nombre, fecha_nacimiento, id_cinta_actual, num_control_responsable,
          email, direccion, tipo_sangre, contacto_emergencia, tel_emergencia, notas_medicas, dia_pago, parentesco)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [num_control, nombre, fecha_nacimiento, id_cinta_actual || 1, resp_id,
       email || null, direccion || null, tipo_sangre || null,
       contacto_emergencia || null, tel_emergencia || null, notas_medicas || null,
       (req.body.dia_pago === 15 ? 15 : 1), parentesco || null]
    );
    await client.query('COMMIT');
    res.status(201).json({ alumno: alumnoRows[0], password_temporal, message: 'Alumno registrado correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'El ID o usuario ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error al registrar alumno' });
  } finally {
    client.release();
  }
});

// GET /api/alumnos
router.get('/', auth, async (req, res) => {
  try {
    let query, params = [];
    if (req.user.rol === 'responsable') {
      query = `
        SELECT a.*, c.color AS cinta_color, c.nombre_grado,
               r.nombre AS responsable_nombre, r.telefono AS responsable_tel,
               cl.id_clase, cl.nombre AS clase_nombre, cl.dia_semana AS clase_dias,
               cl.hora_inicio AS clase_hora_inicio, cl.hora_fin AS clase_hora_fin
        FROM alumnos a
        JOIN cintas c ON c.id_cinta = a.id_cinta_actual
        JOIN responsables r ON r.num_control = a.num_control_responsable
        LEFT JOIN LATERAL (
          SELECT id_clase FROM inscripciones
          WHERE num_control_alumno = a.num_control
          ORDER BY id_inscripcion DESC LIMIT 1
        ) ins ON true
        LEFT JOIN clases cl ON cl.id_clase = ins.id_clase
        WHERE a.num_control_responsable = $1 ORDER BY a.nombre`;
      params = [req.user.id_responsable];
    } else {
      query = `
        SELECT a.*, c.color AS cinta_color, c.nombre_grado,
               r.nombre AS responsable_nombre, r.telefono AS responsable_tel,
               (SELECT u.username FROM usuarios u WHERE u.num_control_responsable = a.num_control_responsable LIMIT 1) AS usuario_login,
               cl.id_clase, cl.nombre AS clase_nombre, cl.dia_semana AS clase_dias,
               cl.hora_inicio AS clase_hora_inicio, cl.hora_fin AS clase_hora_fin
        FROM alumnos a
        JOIN cintas c ON c.id_cinta = a.id_cinta_actual
        JOIN responsables r ON r.num_control = a.num_control_responsable
        LEFT JOIN LATERAL (
          SELECT id_clase FROM inscripciones
          WHERE num_control_alumno = a.num_control
          ORDER BY id_inscripcion DESC LIMIT 1
        ) ins ON true
        LEFT JOIN clases cl ON cl.id_clase = ins.id_clase
        ORDER BY a.nombre`;
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener alumnos' });
  }
});

// GET /api/alumnos/:id — un responsable solo puede ver a sus propios alumnos
router.get('/:id', auth, async (req, res) => {
  try {
    if (!(await puedeTocarAlumno(req.user, req.params.id)))
      return res.status(404).json({ error: 'Alumno no encontrado' });
    const { rows } = await pool.query(
      `SELECT a.*, c.color AS cinta_color, c.nombre_grado,
              r.nombre AS responsable_nombre, r.telefono AS responsable_tel,
              cl.id_clase, cl.nombre AS clase_nombre, cl.dia_semana AS clase_dias,
              cl.hora_inicio AS clase_hora_inicio, cl.hora_fin AS clase_hora_fin
       FROM alumnos a
       JOIN cintas c ON c.id_cinta = a.id_cinta_actual
       JOIN responsables r ON r.num_control = a.num_control_responsable
       LEFT JOIN LATERAL (
         SELECT id_clase FROM inscripciones
         WHERE num_control_alumno = a.num_control
         ORDER BY id_inscripcion DESC LIMIT 1
       ) ins ON true
       LEFT JOIN clases cl ON cl.id_clase = ins.id_clase
       WHERE a.num_control = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/alumnos
router.post('/', auth, allow('admin','instructor'), async (req, res) => {
  const { num_control, nombre, fecha_nacimiento, id_cinta_actual, num_control_responsable } = req.body;
  if (!num_control || !nombre || !fecha_nacimiento || !id_cinta_actual || !num_control_responsable)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO alumnos (num_control, nombre, fecha_nacimiento, id_cinta_actual, num_control_responsable)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [num_control, nombre, fecha_nacimiento, id_cinta_actual, num_control_responsable]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Num. de control ya existe' });
    res.status(500).json({ error: 'Error al registrar alumno' });
  }
});

// PUT /api/alumnos/:id
router.put('/:id', auth, allow('admin','instructor'), async (req, res) => {
  const { nombre, fecha_nacimiento, fecha_ingreso, id_cinta_actual,
          email, direccion, tipo_sangre,
          contacto_emergencia, tel_emergencia, notas_medicas } = req.body;
  const { responsable_nombre, responsable_telefono, parentesco } = req.body;
  try {
    // Actualiza alumno y tutor en una sola sentencia: o se guardan los dos o ninguno
    const { rows } = await pool.query(
      `WITH a AS (
         UPDATE alumnos
         SET nombre=$1, fecha_nacimiento=$2, id_cinta_actual=$3,
             email=$4, direccion=$5, tipo_sangre=$6,
             contacto_emergencia=$7, tel_emergencia=$8, notas_medicas=$9,
             fecha_ingreso=COALESCE($10::date, fecha_ingreso),
             dia_pago=$11,
             parentesco=COALESCE($15::varchar, parentesco)
         WHERE num_control=$12 RETURNING *
       ), r AS (
         UPDATE responsables
         SET nombre=COALESCE(NULLIF($13::text,''), responsables.nombre),
             telefono=COALESCE($14::text, responsables.telefono)
         FROM a WHERE responsables.num_control = a.num_control_responsable
       )
       SELECT * FROM a`,
      [nombre, fecha_nacimiento, id_cinta_actual,
       email || null, direccion || null, tipo_sangre || null,
       contacto_emergencia || null, tel_emergencia || null, notas_medicas || null,
       fecha_ingreso || null,
       (req.body.dia_pago === 15 ? 15 : 1),
       req.params.id,
       responsable_nombre ?? null, responsable_telefono ?? null, parentesco || null]
    );
    if (!rows.length) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar alumno' });
  }
});

// PUT /api/alumnos/:id/tutor — cambia al alumno de tutor (parentesco). Sus pagos se van con él.
// Body: { num_control_responsable, parentesco } o { nuevo_tutor: { nombre, telefono }, parentesco }
router.put('/:id/tutor', auth, allow('admin','instructor'), async (req, res) => {
  const { num_control_responsable, nuevo_tutor, parentesco } = req.body;
  if (!num_control_responsable && !nuevo_tutor?.nombre)
    return res.status(400).json({ error: 'Indica el tutor' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: alumno } = await client.query(
      'SELECT num_control_responsable FROM alumnos WHERE num_control = $1 FOR UPDATE', [req.params.id]
    );
    if (!alumno.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    const anterior = alumno[0].num_control_responsable;

    let destino = num_control_responsable;
    let password_temporal = null;
    let username = null;
    if (destino) {
      const { rows: cuenta } = await client.query(
        'SELECT 1 FROM usuarios WHERE num_control_responsable = $1', [destino]
      );
      if (!cuenta.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Tutor no encontrado' });
      }
    } else {
      // Los IDs son de máximo 20 caracteres; si el del alumno ya está ocupado se genera uno corto
      const sufijo = Date.now().toString(36);
      const { rows: respOcupado } = await client.query(
        'SELECT 1 FROM responsables WHERE num_control = $1', [`RESP-${req.params.id}`]
      );
      destino = respOcupado.length ? `RESP-${sufijo}` : `RESP-${req.params.id}`;
      const { rows: userOcupado } = await client.query(
        'SELECT 1 FROM usuarios WHERE LOWER(username) = LOWER($1)', [req.params.id]
      );
      username = userOcupado.length ? `T-${sufijo}` : req.params.id;
      password_temporal = await crearTutor(client, destino, username, nuevo_tutor);
    }

    await client.query(
      `UPDATE alumnos SET num_control_responsable = $1, parentesco = COALESCE($2::varchar, parentesco)
       WHERE num_control = $3`,
      [destino, parentesco || null, req.params.id]
    );
    await client.query(
      'UPDATE pagos SET num_control_responsable = $1 WHERE num_control_alumno = $2',
      [destino, req.params.id]
    );

    // Si el tutor anterior se quedó sin alumnos, ya no necesita acceso (su historial se conserva)
    if (anterior !== destino) {
      const { rows: quedan } = await client.query(
        'SELECT 1 FROM alumnos WHERE num_control_responsable = $1 LIMIT 1', [anterior]
      );
      if (!quedan.length)
        await client.query('DELETE FROM usuarios WHERE num_control_responsable = $1', [anterior]);
    }
    const { rows: tutor } = await client.query(
      `SELECT r.num_control, r.nombre, r.telefono,
              (SELECT u.username FROM usuarios u WHERE u.num_control_responsable = r.num_control LIMIT 1) AS usuario_login
       FROM responsables r WHERE r.num_control = $1`, [destino]
    );
    await client.query('COMMIT');
    res.json({ tutor: tutor[0], username, password_temporal });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar de tutor' });
  } finally {
    client.release();
  }
});

// POST /api/alumnos/:id/reset-acceso — genera una contraseña temporal nueva para la familia
router.post('/:id/reset-acceso', auth, allow('admin'), async (req, res) => {
  try {
    const password_temporal = generarPassTemporal();
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(password_temporal, 10);
    const { rows } = await pool.query(
      `UPDATE usuarios u SET password=$1, debe_cambiar=true
       FROM alumnos a
       WHERE a.num_control=$2 AND u.num_control_responsable=a.num_control_responsable
       RETURNING u.username`,
      [hash, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json({ username: rows[0].username, password_temporal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar la contraseña temporal' });
  }
});

// PUT /api/alumnos/:id/personal — el responsable edita datos médicos/emergencia de su alumno
router.put('/:id/personal', auth, async (req, res) => {
  const { direccion, tipo_sangre, contacto_emergencia, tel_emergencia, notas_medicas } = req.body;
  try {
    if (!(await puedeTocarAlumno(req.user, req.params.id)))
      return res.status(404).json({ error: 'Alumno no encontrado' });
    const { rows } = await pool.query(
      `UPDATE alumnos
       SET direccion=$1, tipo_sangre=$2, contacto_emergencia=$3, tel_emergencia=$4, notas_medicas=$5
       WHERE num_control=$6 RETURNING *`,
      [direccion || null, tipo_sangre || null, contacto_emergencia || null,
       tel_emergencia || null, notas_medicas || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar datos personales' });
  }
});

// DELETE /api/alumnos/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: alumnoRows } = await client.query(
      `SELECT num_control_responsable FROM alumnos WHERE num_control = $1`,
      [req.params.id]
    );
    if (!alumnoRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    const resp_id = alumnoRows[0].num_control_responsable;

    // Buscar TODAS las tablas que tienen una llave foránea hacia alumnos(num_control),
    // incluso las que no están en schema.sql (lockers, inscripciones_torneo, etc.).
    const { rows: refs } = await client.query(`
      SELECT kcu.table_name, kcu.column_name, col.is_nullable
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      JOIN information_schema.columns col
        ON col.table_schema = kcu.table_schema
       AND col.table_name   = kcu.table_name
       AND col.column_name  = kcu.column_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name  = 'alumnos'
        AND ccu.column_name = 'num_control'
    `);

    // Limpiar cada referencia: si la columna admite NULL se desvincula (p.ej. lockers),
    // si es obligatoria se borra la fila (p.ej. inscripciones, exámenes, avances).
    for (const ref of refs) {
      if (ref.is_nullable === 'YES') {
        await client.query(
          `UPDATE "${ref.table_name}" SET "${ref.column_name}" = NULL WHERE "${ref.column_name}" = $1`,
          [req.params.id]
        );
      } else {
        await client.query(
          `DELETE FROM "${ref.table_name}" WHERE "${ref.column_name}" = $1`,
          [req.params.id]
        );
      }
    }

    await client.query('DELETE FROM alumnos WHERE num_control = $1', [req.params.id]);

    const { rows: otrosAlumnos } = await client.query(
      `SELECT 1 FROM alumnos WHERE num_control_responsable = $1 LIMIT 1`,
      [resp_id]
    );

    // Si ya no le quedan alumnos: quitamos su acceso (usuario),
    // pero CONSERVAMOS responsable + pagos + mensualidades por historial contable.
    if (otrosAlumnos.length === 0) {
      await client.query(
        `DELETE FROM usuarios WHERE num_control_responsable = $1`, [resp_id]
      );
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Alumno eliminado correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar alumno' });
  } finally {
    client.release();
  }
});

module.exports = router;
