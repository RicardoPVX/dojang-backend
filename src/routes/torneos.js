const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/torneos
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, a.nombre AS alumno_nombre
       FROM torneos t
       LEFT JOIN alumnos a ON a.num_control = t.num_control_alumno
       ORDER BY t.fecha DESC, t.id_torneo`
    );
    res.json(rows);
  } catch(err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// POST /api/torneos — admin crea evento
router.post('/', auth, allow('admin'), async (req, res) => {
  const { nombre_torneo, sede, fecha } = req.body;
  if (!nombre_torneo || !fecha) return res.status(400).json({ error: 'Faltan campos' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO torneos (nombre_torneo, sede, fecha) VALUES ($1,$2,$3) RETURNING *`,
      [nombre_torneo, sede || '', fecha]
    );
    res.status(201).json(rows[0]);
  } catch(err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// POST /api/torneos/:id/inscribir — alumno se apunta
router.post('/:id/inscribir', auth, async (req, res) => {
  const { num_control_alumno } = req.body;
  if (!num_control_alumno) return res.status(400).json({ error: 'Falta alumno' });
  try {
    const { rows: ev } = await pool.query(
      `SELECT nombre_torneo, sede, fecha FROM torneos WHERE id_torneo=$1`, [req.params.id]
    );
    if (!ev.length) return res.status(404).json({ error: 'Torneo no encontrado' });
    const { rows: dup } = await pool.query(
      `SELECT 1 FROM torneos WHERE nombre_torneo=$1 AND fecha=$2 AND num_control_alumno=$3`,
      [ev[0].nombre_torneo, ev[0].fecha, num_control_alumno]
    );
    if (dup.length) return res.status(409).json({ error: 'Ya inscrito' });
    const { rows } = await pool.query(
      `INSERT INTO torneos (nombre_torneo, sede, fecha, num_control_alumno) VALUES ($1,$2,$3,$4) RETURNING *`,
      [ev[0].nombre_torneo, ev[0].sede, ev[0].fecha, num_control_alumno]
    );
    res.status(201).json(rows[0]);
  } catch(err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// DELETE /api/torneos/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM torneos WHERE id_torneo=$1', [req.params.id]);
    res.json({ mensaje: 'Eliminado' });
  } catch(err) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;