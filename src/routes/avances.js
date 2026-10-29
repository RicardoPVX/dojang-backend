const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/avances?alumno=NUM_CONTROL
router.get('/', auth, async (req, res) => {
  try {
    let query, params = [];

    if (req.query.alumno && req.user.rol === 'responsable') {
      // Un responsable solo puede filtrar entre sus propios alumnos
      query = `
        SELECT av.*, i.nombre AS instructor_nombre, a.nombre AS alumno_nombre
        FROM avances av
        JOIN instructores i ON i.id_instructor = av.id_instructor
        JOIN alumnos a ON a.num_control = av.num_control_alumno
        WHERE av.num_control_alumno = $1 AND a.num_control_responsable = $2
        ORDER BY av.fecha DESC`;
      params = [req.query.alumno, req.user.id_responsable];
    } else if (req.query.alumno) {
      // Filtrar por alumno específico
      query = `
        SELECT av.*, i.nombre AS instructor_nombre, a.nombre AS alumno_nombre
        FROM avances av
        JOIN instructores i ON i.id_instructor = av.id_instructor
        JOIN alumnos a ON a.num_control = av.num_control_alumno
        WHERE av.num_control_alumno = $1
        ORDER BY av.fecha DESC`;
      params = [req.query.alumno];
    } else if (req.user.rol === 'responsable') {
      query = `
        SELECT av.*, i.nombre AS instructor_nombre, a.nombre AS alumno_nombre
        FROM avances av
        JOIN instructores i ON i.id_instructor = av.id_instructor
        JOIN alumnos a ON a.num_control = av.num_control_alumno
        WHERE a.num_control_responsable = $1
        ORDER BY av.fecha DESC`;
      params = [req.user.id_responsable];
    } else {
      query = `
        SELECT av.*, i.nombre AS instructor_nombre, a.nombre AS alumno_nombre
        FROM avances av
        JOIN instructores i ON i.id_instructor = av.id_instructor
        JOIN alumnos a ON a.num_control = av.num_control_alumno
        ORDER BY av.fecha DESC`;
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener avances' });
  }
});

// POST /api/avances  — solo instructor o admin
router.post('/', auth, allow('admin','instructor'), async (req, res) => {
  const { fecha, observacion, num_control_alumno, id_instructor } = req.body;
  if (!observacion || !num_control_alumno || !id_instructor)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO avances (fecha, observacion, num_control_alumno, id_instructor)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [fecha || new Date().toISOString().split('T')[0], observacion,
       num_control_alumno, id_instructor]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar avance' });
  }
});

module.exports = router;
