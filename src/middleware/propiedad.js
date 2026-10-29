const pool = require('../db/pool');

// Admin e instructor pueden tocar a cualquier alumno; un responsable solo a los suyos
async function puedeTocarAlumno(user, numControl) {
  if (user.rol !== 'responsable') return true;
  if (!numControl) return false;
  const { rows } = await pool.query(
    'SELECT 1 FROM alumnos WHERE num_control = $1 AND num_control_responsable = $2',
    [numControl, user.id_responsable]
  );
  return rows.length > 0;
}

module.exports = { puedeTocarAlumno };
