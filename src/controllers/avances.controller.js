const Avance = require('../models/avances.model');

// GET /api/avances?alumno=NUM_CONTROL
async function getAvances(req, res) {
  try {
    const avances = await Avance.getAll(req.user, req.query.alumno);
    res.json(avances);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener avances' });
  }
}

// POST /api/avances
async function crearAvance(req, res) {
  const { observacion, num_control_alumno, id_instructor } = req.body;
  if (!observacion || !num_control_alumno || !id_instructor)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const avance = await Avance.create(req.body);
    res.status(201).json(avance);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar avance' });
  }
}

module.exports = { getAvances, crearAvance };
