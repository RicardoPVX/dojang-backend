const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/examenes — todos los exámenes (individuales y grupales)
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*,
             a.nombre AS alumno_nombre,
             ca.color AS cinta_aspirada_color,
             ca.nombre_grado AS cinta_aspirada_nombre
      FROM examenes e
      LEFT JOIN alumnos a  ON a.num_control = e.num_control_alumno
      LEFT JOIN cintas  ca ON ca.id_cinta   = e.id_cinta_aspirada
      ORDER BY e.fecha DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener exámenes' });
  }
});

// POST /api/examenes — crear examen (individual o grupal)
router.post('/', auth, allow('admin'), async (req, res) => {
  const { fecha, observaciones, resultado = 'Pendiente',
          num_control_alumno, id_cinta_aspirada,
          nombre_examen, sede } = req.body;

  if (!fecha) return res.status(400).json({ error: 'La fecha es obligatoria' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO examenes
         (fecha, observaciones, resultado,
          num_control_alumno, id_cinta_aspirada, nombre_examen, sede)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [fecha, observaciones || null, resultado,
       num_control_alumno || null, id_cinta_aspirada || null,
       nombre_examen || null, sede || null]
    );

    // Si aprobó y tiene alumno asignado, actualizar cinta
    if (resultado === 'Aprobado' && num_control_alumno && id_cinta_aspirada) {
      await pool.query(
        `UPDATE alumnos SET id_cinta_actual = $1 WHERE num_control = $2`,
        [id_cinta_aspirada, num_control_alumno]
      );
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar examen' });
  }
});

// PUT /api/examenes/:id — actualizar examen completo
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { fecha, resultado, observaciones, nombre_examen, sede, id_cinta_aspirada } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE examenes
       SET fecha               = COALESCE($1::date, fecha),
           resultado           = COALESCE($2, resultado),
           observaciones       = $3,
           nombre_examen       = COALESCE($4, nombre_examen),
           sede                = COALESCE($5, sede),
           id_cinta_aspirada   = COALESCE($6::int, id_cinta_aspirada)
       WHERE id_examen = $7 RETURNING *`,
      [fecha || null, resultado || null, observaciones || null,
       nombre_examen || null, sede || null,
       id_cinta_aspirada || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Examen no encontrado' });

    // Si aprobó y tiene alumno, actualizar cinta
    if (resultado === 'Aprobado') {
      await pool.query(
        `UPDATE alumnos SET id_cinta_actual = (
           SELECT id_cinta_aspirada FROM examenes WHERE id_examen = $1
         ) WHERE num_control = (
           SELECT num_control_alumno FROM examenes WHERE id_examen = $1
         ) AND (SELECT num_control_alumno FROM examenes WHERE id_examen = $1) IS NOT NULL`,
        [req.params.id]
      );
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar examen' });
  }
});

// DELETE /api/examenes/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM examenes WHERE id_examen = $1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Examen no encontrado' });
    res.json({ mensaje: 'Examen eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar examen' });
  }
});

module.exports = router;
