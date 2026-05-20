const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/examenes  — todos (admin/instructor) o los del responsable
router.get('/', auth, async (req, res) => {
  try {
    let query, params = [];
    const base = `
      SELECT e.*, a.nombre AS alumno_nombre,
             ca.color AS cinta_aspirada_color, ca.nombre_grado AS cinta_aspirada_nombre
      FROM examenes e
      JOIN alumnos a ON a.num_control = e.num_control_alumno
      JOIN cintas ca ON ca.id_cinta = e.id_cinta_aspirada`;

    if (req.user.rol === 'responsable') {
      query = base + ` WHERE a.num_control_responsable = $1 ORDER BY e.fecha DESC`;
      params = [req.user.id_responsable];
    } else {
      query = base + ` ORDER BY e.fecha DESC`;
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener exámenes' });
  }
});

// POST /api/examenes  — registrar examen
router.post('/', auth, allow('admin','instructor'), async (req, res) => {
  const { fecha, observaciones, resultado = 'Pendiente', bimestre,
          num_control_alumno, id_cinta_aspirada, id_pago } = req.body;

  if (!num_control_alumno || !id_cinta_aspirada)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO examenes (fecha, observaciones, resultado, bimestre,
        num_control_alumno, id_cinta_aspirada, id_pago)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [fecha, observaciones, resultado, bimestre,
       num_control_alumno, id_cinta_aspirada, id_pago || null]
    );

    // Si aprobó, actualizar cinta del alumno automáticamente
    if (resultado === 'Aprobado') {
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

// PUT /api/examenes/:id  — actualizar resultado y observaciones
router.put('/:id', auth, allow('admin','instructor'), async (req, res) => {
  const { resultado, observaciones } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE examenes SET resultado=$1, observaciones=$2
       WHERE id_examen=$3 RETURNING *`,
      [resultado, observaciones, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Examen no encontrado' });

    // Si acaban de aprobar, actualizar cinta
    if (resultado === 'Aprobado') {
      await pool.query(
        `UPDATE alumnos SET id_cinta_actual = (
           SELECT id_cinta_aspirada FROM examenes WHERE id_examen = $1
         ) WHERE num_control = (
           SELECT num_control_alumno FROM examenes WHERE id_examen = $1
         )`, [req.params.id]
      );
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar examen' });
  }
});

// DELETE /api/examenes/:id
router.delete('/:id', auth, allow('admin','instructor'), async (req, res) => {
  try {
    await pool.query('DELETE FROM examenes WHERE id_examen=$1', [req.params.id]);
    res.json({ mensaje: 'Examen eliminado' });
  } catch(err) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
