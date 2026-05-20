const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/clases — todas las clases con su instructor y lista de alumnos
router.get('/', auth, async (req, res) => {
  try {
    const { rows: clases } = await pool.query(
      `SELECT cl.*, i.nombre AS instructor_nombre
       FROM clases cl
       LEFT JOIN instructores i ON i.id_instructor = cl.id_instructor
       ORDER BY cl.hora_inicio, cl.id_clase`
    );
    // Para cada clase, traer sus alumnos inscritos
    for (const cl of clases) {
      const { rows: alumnos } = await pool.query(
        `SELECT a.num_control, a.nombre, c.color AS cinta_color
         FROM inscripciones ins
         JOIN alumnos a ON a.num_control = ins.num_control_alumno
         JOIN cintas c ON c.id_cinta = a.id_cinta_actual
         WHERE ins.id_clase = $1
         ORDER BY a.nombre`,
        [cl.id_clase]
      );
      cl.alumnos = alumnos;
    }
    res.json(clases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener clases' });
  }
});

// POST /api/clases — crear clase
router.post('/', auth, allow('admin'), async (req, res) => {
  const { nombre, dia_semana, hora_inicio, hora_fin, id_instructor } = req.body;
  if (!dia_semana || !hora_inicio || !hora_fin)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO clases (nombre, dia_semana, hora_inicio, hora_fin, id_instructor)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre || 'Clase', dia_semana, hora_inicio, hora_fin, id_instructor || 1]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear clase' });
  }
});

// PUT /api/clases/:id — editar clase
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar clase' });
  }
});

// DELETE /api/clases/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM inscripciones WHERE id_clase=$1', [req.params.id]);
    await pool.query('DELETE FROM clases WHERE id_clase=$1', [req.params.id]);
    res.json({ mensaje: 'Clase eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar clase' });
  }
});

// PUT /api/clases/alumno/:num_control — asignar clase a alumno
router.put('/alumno/:num_control', auth, allow('admin','instructor'), async (req, res) => {
  const { id_clase } = req.body;
  const num_control = req.params.num_control;
  try {
    // Borrar inscripción anterior
    await pool.query('DELETE FROM inscripciones WHERE num_control_alumno=$1', [num_control]);
    if (id_clase) {
      await pool.query(
        `INSERT INTO inscripciones (num_control_alumno, id_clase, fecha_ins)
         VALUES ($1,$2,NOW()::date)`,
        [num_control, id_clase]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asignar clase' });
  }
});

module.exports = router;
