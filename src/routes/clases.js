const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/clases/alumnos — asignaciones alumno-clase (antes que /:id)
router.get('/alumnos', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.num_control_alumno, i.id_clase,
             cl.nombre AS clase_nombre, cl.dia_semana, cl.hora_inicio, cl.hora_fin
      FROM inscripciones i
      JOIN clases cl ON cl.id_clase = i.id_clase
    `);
    res.json(rows);
  } catch(err) {
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// PUT /api/clases/alumno/:alumnoId — asignar o cambiar clase
router.put('/alumno/:alumnoId', auth, allow('admin','instructor'), async (req, res) => {
  const { id_clase } = req.body;
  const alumnoId = req.params.alumnoId;
  try {
    await pool.query('DELETE FROM inscripciones WHERE num_control_alumno=$1', [alumnoId]);
    if (id_clase) {
      await pool.query(
        `INSERT INTO inscripciones (num_control_alumno, id_clase) VALUES ($1,$2)`,
        [alumnoId, id_clase]
      );
    }
    res.json({ ok: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asignar clase' });
  }
});

// GET /api/clases
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cl.*, i.nombre AS instructor_nombre
       FROM clases cl
       LEFT JOIN instructores i ON i.id_instructor = cl.id_instructor
       ORDER BY cl.hora_inicio`
    );
    res.json(rows);
  } catch(err) {
    res.status(500).json({ error: 'Error al obtener clases' });
  }
});

// POST /api/clases
router.post('/', auth, allow('admin'), async (req, res) => {
  const { nombre, dia_semana, hora_inicio, hora_fin, id_instructor } = req.body;
  if (!dia_semana || !hora_inicio || !hora_fin)
    return res.status(400).json({ error: 'Días y horario son obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO clases (nombre, dia_semana, hora_inicio, hora_fin, id_instructor)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre||'Clase', dia_semana, hora_inicio, hora_fin, id_instructor || 1]
    );
    res.status(201).json(rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Error al crear clase' });
  }
});

// PUT /api/clases/:id
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { nombre, dia_semana, hora_inicio, hora_fin, id_instructor } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE clases SET nombre=$1, dia_semana=$2, hora_inicio=$3, hora_fin=$4, id_instructor=$5
       WHERE id_clase=$6 RETURNING *`,
      [nombre, dia_semana, hora_inicio, hora_fin, id_instructor, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Clase no encontrada' });
    res.json(rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Error al actualizar clase' });
  }
});

// DELETE /api/clases/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM inscripciones WHERE id_clase=$1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM clases WHERE id_clase=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Clase no encontrada' });
    res.json({ mensaje: 'Clase eliminada' });
  } catch(err) {
    res.status(500).json({ error: 'Error al eliminar clase' });
  }
});

module.exports = router;
