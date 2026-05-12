const Examen = require('../models/examenes.model');

// GET /api/examenes
async function getExamenes(req, res) {
  try {
    const examenes = await Examen.getAll(req.user);
    res.json(examenes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener exámenes' });
  }
}

// POST /api/examenes
async function crearExamen(req, res) {
  const { num_control_alumno, id_cinta_aspirada } = req.body;
  if (!num_control_alumno || !id_cinta_aspirada)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const examen = await Examen.create(req.body);
    res.status(201).json(examen);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar examen' });
  }
}

// PUT /api/examenes/:id
async function actualizarExamen(req, res) {
  try {
    const examen = await Examen.update(req.params.id, req.body);
    if (!examen) return res.status(404).json({ error: 'Examen no encontrado' });
    res.json(examen);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar examen' });
  }
}

module.exports = { getExamenes, crearExamen, actualizarExamen };
