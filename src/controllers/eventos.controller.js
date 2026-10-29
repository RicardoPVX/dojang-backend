const Evento = require('../models/eventos.model');

// GET /api/eventos
async function getEventos(req, res) {
  try {
    res.json(await Evento.getAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
}

// POST /api/eventos — admin/instructor
async function crearEvento(req, res) {
  const { titulo, fecha } = req.body;
  if (!titulo || !fecha)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    res.status(201).json(await Evento.create(req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear evento' });
  }
}

// PUT /api/eventos/:id — admin/instructor
async function actualizarEvento(req, res) {
  const { titulo, fecha } = req.body;
  if (!titulo || !fecha)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const evento = await Evento.update(req.params.id, req.body);
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(evento);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
}

// DELETE /api/eventos/:id — admin/instructor
async function eliminarEvento(req, res) {
  try {
    const eliminado = await Evento.remove(req.params.id);
    if (!eliminado) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json({ mensaje: 'Evento eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
}

module.exports = { getEventos, crearEvento, actualizarEvento, eliminarEvento };
