const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/pagos  — admin ve todos; responsable solo los suyos
router.get('/', auth, async (req, res) => {
  try {
    let query, params = [];
    if (req.user.rol === 'responsable') {
      query = `SELECT p.*, r.nombre AS responsable_nombre
               FROM pagos p JOIN responsables r ON r.num_control = p.num_control_responsable
               WHERE p.num_control_responsable = $1 ORDER BY p.fecha_pago DESC`;
      params = [req.user.num_control_responsable || req.user.id_responsable];
    } else {
      query = `SELECT p.*, r.nombre AS responsable_nombre
               FROM pagos p JOIN responsables r ON r.num_control = p.num_control_responsable
               ORDER BY p.fecha_pago DESC`;
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// POST /api/pagos  — registrar pago (mensualidad, equipo, examen…)
router.post('/', auth, allow('admin'), async (req, res) => {
  const { monto_total, monto_abonado = 0, fecha_pago, metodo_pago,
          tipo_pago, estado_pago = 'Pendiente', num_control_responsable } = req.body;

  if (!monto_total || !tipo_pago || !num_control_responsable)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO pagos (monto_total, monto_abonado, fecha_pago, metodo_pago,
        tipo_pago, estado_pago, num_control_responsable)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [monto_total, monto_abonado, fecha_pago || new Date().toISOString().split('T')[0],
       metodo_pago, tipo_pago, estado_pago, num_control_responsable]
    );

    // Si es mensualidad, crear detalle automáticamente
    if (tipo_pago === 'Mensualidad' && req.body.mes_correspondiente) {
      await pool.query(
        `INSERT INTO mensualidades (id_pago, mes_correspondiente, anio)
         VALUES ($1,$2,$3)`,
        [rows[0].id_pago, req.body.mes_correspondiente,
         req.body.anio || new Date().getFullYear()]
      );
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar pago', code: err.code, detalle: err.detail || err.message });
  }
});

// PUT /api/pagos/:id/abonar  — registrar un abono parcial
router.put('/:id/abonar', auth, allow('admin'), async (req, res) => {
  const { abono } = req.body;
  if (!abono || abono <= 0) return res.status(400).json({ error: 'Abono inválido' });

  try {
    const { rows } = await pool.query(
      `UPDATE pagos
       SET monto_abonado = monto_abonado + $1,
           estado_pago = CASE WHEN monto_abonado + $1 >= monto_total THEN 'Liquidado' ELSE estado_pago END
       WHERE id_pago = $2 RETURNING *`,
      [abono, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar abono' });
  }
});

// DELETE /api/pagos/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    // Eliminar mensualidad asociada si existe
    await pool.query('DELETE FROM mensualidades WHERE id_pago = $1', [req.params.id]);
    const { rowCount } = await pool.query(
      'DELETE FROM pagos WHERE id_pago = $1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json({ mensaje: 'Pago eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar pago' });
  }
});

// PUT /api/pagos/:id — editar pago
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { monto_total, monto_abonado, fecha_pago, metodo_pago, tipo_pago, estado_pago, num_control_responsable } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE pagos SET
         monto_total   = COALESCE($1, monto_total),
         monto_abonado = COALESCE($2, monto_abonado),
         fecha_pago    = COALESCE($3, fecha_pago),
         metodo_pago   = COALESCE($4, metodo_pago),
         tipo_pago     = COALESCE($5, tipo_pago),
         estado_pago   = COALESCE($6, estado_pago),
         num_control_responsable = COALESCE($7, num_control_responsable)
       WHERE id_pago = $8
       RETURNING *`,
      [monto_total ?? null, monto_abonado ?? null, fecha_pago ?? null, metodo_pago ?? null,
       tipo_pago ?? null, estado_pago ?? null, num_control_responsable ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar pago', code: err.code, detalle: err.detail || err.message });
  }
});

module.exports = router;
