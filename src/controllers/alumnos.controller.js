const Alumno = require('../models/alumnos.model');

// GET /api/alumnos/publico — sin token
async function getPublico(req, res) {
  try {
    const alumnos = await Alumno.getPublico();
    res.json(alumnos);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
}

// POST /api/alumnos/registro-completo — admin/instructor
async function registroCompleto(req, res) {
  const { num_control, nombre, fecha_nacimiento,
          responsable_nombre, username, password } = req.body;

  if (!num_control || !nombre || !fecha_nacimiento || !responsable_nombre || !username || !password)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const alumno = await Alumno.registroCompleto(req.body);
    res.status(201).json({ alumno, message: 'Alumno registrado correctamente' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El ID o usuario ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error al registrar alumno' });
  }
}

// GET /api/alumnos
async function getAlumnos(req, res) {
  try {
    const alumnos = await Alumno.getAll(req.user);
    res.json(alumnos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener alumnos' });
  }
}

// GET /api/alumnos/:id
async function getAlumno(req, res) {
  try {
    const alumno = await Alumno.getById(req.params.id);
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json(alumno);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

// POST /api/alumnos — admin/instructor
async function crearAlumno(req, res) {
  const { num_control, nombre, fecha_nacimiento, id_cinta_actual, num_control_responsable } = req.body;
  if (!num_control || !nombre || !fecha_nacimiento || !id_cinta_actual || !num_control_responsable)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const alumno = await Alumno.create(req.body);
    res.status(201).json(alumno);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Num. de control ya existe' });
    res.status(500).json({ error: 'Error al registrar alumno' });
  }
}

// PUT /api/alumnos/:id — admin/instructor
async function actualizarAlumno(req, res) {
  try {
    const alumno = await Alumno.update(req.params.id, req.body);
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json(alumno);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar alumno' });
  }
}

// DELETE /api/alumnos/:id — admin
async function eliminarAlumno(req, res) {
  try {
    const eliminado = await Alumno.remove(req.params.id);
    if (!eliminado) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json({ mensaje: 'Alumno eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar alumno' });
  }
}

module.exports = {
  getPublico, registroCompleto, getAlumnos, getAlumno,
  crearAlumno, actualizarAlumno, eliminarAlumno
};
