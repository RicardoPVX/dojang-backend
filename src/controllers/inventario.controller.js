const Inventario = require('../models/inventario.model');

// GET /api/inventario
async function getInventario(req, res) {
  try {
    const items = await Inventario.getAll();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
}

// POST /api/inventario
async function crearArticulo(req, res) {
  const { descripcion, precio_unitario } = req.body;
  if (!descripcion || !precio_unitario)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const articulo = await Inventario.create(req.body);
    res.status(201).json(articulo);
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar artículo' });
  }
}

// PUT /api/inventario/:id
async function actualizarArticulo(req, res) {
  try {
    const articulo = await Inventario.update(req.params.id, req.body);
    if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json(articulo);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar artículo' });
  }
}

// DELETE /api/inventario/:id
async function eliminarArticulo(req, res) {
  try {
    await Inventario.remove(req.params.id);
    res.json({ mensaje: 'Artículo eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar artículo' });
  }
}

module.exports = { getInventario, crearArticulo, actualizarArticulo, eliminarArticulo };
