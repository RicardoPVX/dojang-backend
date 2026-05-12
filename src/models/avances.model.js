const pool = require('../db/pool');

const BASE_QUERY = `
  SELECT av.*, i.nombre AS instructor_nombre, a.nombre AS alumno_nombre
  FROM avances av
  JOIN instructores i ON i.id_instructor = av.id_instructor
  JOIN alumnos a ON a.num_control = av.num_control_alumno`;

// Devuelve avances filtrados por alumno, responsable o todos (admin/instructor)
async function getAll(user, alumnoFiltro) {
  if (alumnoFiltro) {
    const { rows } = await pool.query(
      BASE_QUERY + ` WHERE av.num_control_alumno = $1 ORDER BY av.fecha DESC`,
      [alumnoFiltro]
    );
    return rows;
  }
  if (user.rol === 'responsable') {
    const { rows } = await pool.query(
      BASE_QUERY + ` WHERE a.num_control_responsable = $1 ORDER BY av.fecha DESC`,
      [user.id_responsable]
    );
    return rows;
  }
  const { rows } = await pool.query(BASE_QUERY + ` ORDER BY av.fecha DESC`);
  return rows;
}

// Registra un avance del instructor sobre un alumno
async function create({ fecha, observacion, num_control_alumno, id_instructor }) {
  const { rows } = await pool.query(
    `INSERT INTO avances (fecha, observacion, num_control_alumno, id_instructor)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [fecha || new Date().toISOString().split('T')[0],
     observacion, num_control_alumno, id_instructor]
  );
  return rows[0];
}

module.exports = { getAll, create };
