const pool = require('../db/pool');

const BASE_QUERY = `
  SELECT e.*, a.nombre AS alumno_nombre,
         ca.color AS cinta_aspirada_color, ca.nombre_grado AS cinta_aspirada_nombre
  FROM examenes e
  JOIN alumnos a ON a.num_control = e.num_control_alumno
  JOIN cintas ca ON ca.id_cinta = e.id_cinta_aspirada`;

// Devuelve todos los exámenes (admin/instructor) o solo los del responsable
async function getAll(user) {
  if (user.rol === 'responsable') {
    const { rows } = await pool.query(
      BASE_QUERY + ` WHERE a.num_control_responsable = $1 ORDER BY e.fecha DESC`,
      [user.id_responsable]
    );
    return rows;
  }
  const { rows } = await pool.query(BASE_QUERY + ` ORDER BY e.fecha DESC`);
  return rows;
}

// Registra un examen; si resultado es 'Aprobado', actualiza la cinta del alumno
async function create(data) {
  const {
    fecha, observaciones, resultado = 'Pendiente',
    bimestre, num_control_alumno, id_cinta_aspirada, id_pago
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO examenes (fecha, observaciones, resultado, bimestre,
      num_control_alumno, id_cinta_aspirada, id_pago)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [fecha, observaciones, resultado, bimestre,
     num_control_alumno, id_cinta_aspirada, id_pago || null]
  );
  const examen = rows[0];

  if (resultado === 'Aprobado') {
    await pool.query(
      `UPDATE alumnos SET id_cinta_actual = $1 WHERE num_control = $2`,
      [id_cinta_aspirada, num_control_alumno]
    );
  }

  return examen;
}

// Actualiza resultado/observaciones; si aprueba, actualiza la cinta automáticamente
async function update(id, { resultado, observaciones }) {
  const { rows } = await pool.query(
    `UPDATE examenes SET resultado=$1, observaciones=$2
     WHERE id_examen=$3 RETURNING *`,
    [resultado, observaciones, id]
  );
  if (!rows.length) return null;

  if (resultado === 'Aprobado') {
    await pool.query(
      `UPDATE alumnos SET id_cinta_actual = (
         SELECT id_cinta_aspirada FROM examenes WHERE id_examen = $1
       ) WHERE num_control = (
         SELECT num_control_alumno FROM examenes WHERE id_examen = $1
       )`, [id]
    );
  }

  return rows[0];
}

module.exports = { getAll, create, update };
