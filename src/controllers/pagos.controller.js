const Pago = require('../models/pagos.model');

// GET /api/pagos
async function getPagos(req, res) {
  try {
    const pagos = await Pago.getAll(req.user);
    res.json(pagos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
}

// POST /api/pagos
async function crearPago(req, res) {
  const { monto_total, tipo_pago, num_control_responsable } = req.body;
  if (!monto_total || !tipo_pago || !num_control_responsable)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const pago = await Pago.create(req.body);
    res.status(201).json(pago);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar pago' });
  }
}

// PUT /api/pagos/:id/abonar
async function abonar(req, res) {
  const { abono } = req.body;
  if (!abono || abono <= 0)
    return res.status(400).json({ error: 'Abono inválido' });

  try {
    const pago = await Pago.abonar(req.params.id, abono);
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(pago);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar abono' });
  }
}

module.exports = { getPagos, crearPago, abonar };
