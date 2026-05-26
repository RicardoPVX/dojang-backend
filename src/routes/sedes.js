const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/sedes?id_torneo=X
router.get('/', auth, async (req, res) => {
  try {
    const { id_torneo } = req.query;
    let query = `SELECT s.*, COUNT(i.id_inscripcion)::int AS inscritos
                 FROM sedes_torneo s
                 LEFT JOIN inscripciones_torneo i ON i.id_sede = s.id_sede`;
    const params = [];
    if (id_torneo) { query += ` WHERE s.id_torneo=$1`; params.push(id_torneo); }
    query += ` GROUP BY s.id_sede ORDER BY s.nombre_sede`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener sedes' });
  }
});

// POST /api/sedes — agregar sede a un torneo
router.post('/', auth, allow('admin','instructor'), async (req, res) => {
  const { id_torneo, nombre_sede, direccion, cupo_max=0 } = req.body;
  if (!id_torneo || !nombre_sede)
    return res.status(400).json({ error: 'Torneo y nombre de sede son obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO sedes_torneo (id_torneo, nombre_sede, direccion, cupo_max)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id_torneo, nombre_sede, direccion||null, cupo_max]
    );
    res.status(201).json(rows[0]);
  } catch(err) {
    res.status(500).json({ error: 'Error al crear sede' });
  }
});

// PUT /api/sedes/:id
router.put('/:id', auth, allow('admin','instructor'), async (req, res) => {
  const { nombre_sede, direccion, cupo_max } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE sedes_torneo SET nombre_sede=$1, direccion=$2, cupo_max=$3
       WHERE id_sede=$4 RETURNING *`,
      [nombre_sede, direccion||null, cupo_max||0, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sede no encontrada' });
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: 'Error al actualizar sede' }); }
});

// DELETE /api/sedes/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM inscripciones_torneo WHERE id_sede=$1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM sedes_torneo WHERE id_sede=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Sede no encontrada' });
    res.json({ mensaje: 'Sede eliminada' });
  } catch(err) { res.status(500).json({ error: 'Error al eliminar sede' }); }
});

// POST /api/sedes/:id/inscribir — alumno se inscribe a una sede
router.post('/:id/inscribir', auth, async (req, res) => {
  const { num_control_alumno } = req.body;
  if (!num_control_alumno)
    return res.status(400).json({ error: 'num_control_alumno es obligatorio' });
  try {
    // Cancelar inscripción previa del alumno en este torneo
    await pool.query(
      `DELETE FROM inscripciones_torneo it
       USING sedes_torneo s
       WHERE it.id_sede = s.id_sede
         AND s.id_torneo = (SELECT id_torneo FROM sedes_torneo WHERE id_sede=$1)
         AND it.num_control_alumno = $2`,
      [req.params.id, num_control_alumno]
    );
    const { rows } = await pool.query(
      `INSERT INTO inscripciones_torneo (id_sede, num_control_alumno)
       VALUES ($1,$2) RETURNING *`,
      [req.params.id, num_control_alumno]
    );
    res.status(201).json(rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al inscribir' });
  }
});

// DELETE /api/sedes/:id/inscribir/:alumnoId — cancelar inscripción
router.delete('/:id/inscribir/:alumnoId', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM inscripciones_torneo WHERE id_sede=$1 AND num_control_alumno=$2',
      [req.params.id, req.params.alumnoId]
    );
    res.json({ mensaje: 'Inscripción cancelada' });
  } catch(err) { res.status(500).json({ error: 'Error al cancelar' }); }
});

module.exports = router;
