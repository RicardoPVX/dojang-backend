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
          tipo_pago, estado_pago = 'Pendiente', num_control_responsable,
          num_cuotas = 1, cuotas_pagadas, monto_cuota, proximo_vencimiento, notas } = req.body;

  if (!monto_total || !tipo_pago || !num_control_responsable)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (!Number.isInteger(num_cuotas) || num_cuotas < 1)
    return res.status(400).json({ error: 'Número de cuotas inválido' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO pagos (monto_total, monto_abonado, fecha_pago, metodo_pago,
        tipo_pago, estado_pago, num_control_responsable,
        num_cuotas, cuotas_pagadas, monto_cuota, proximo_vencimiento, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [monto_total, monto_abonado, fecha_pago || new Date().toISOString().split('T')[0],
       metodo_pago, tipo_pago, estado_pago, num_control_responsable,
       num_cuotas, cuotas_pagadas ?? (estado_pago === 'Liquidado' ? num_cuotas : 0),
       monto_cuota || null, proximo_vencimiento || null, notas || null]
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

// PUT /api/pagos/:id/abonar  — registra una cuota. Sin "abono" en el body, el monto lo calcula
// el servidor: la cuota del plan, y en la última cuota todo el saldo. Nunca se abona de más.
router.put('/:id/abonar', auth, allow('admin'), async (req, res) => {
  const { abono } = req.body;
  if (abono !== undefined && (!abono || abono <= 0))
    return res.status(400).json({ error: 'Abono inválido' });

  try {
    const { rows } = await pool.query(
      `UPDATE pagos p
       SET monto_abonado  = p.monto_abonado + c.abono,
           cuotas_pagadas = LEAST(p.cuotas_pagadas + 1, p.num_cuotas),
           estado_pago    = CASE WHEN p.monto_abonado + c.abono >= p.monto_total THEN 'Liquidado' ELSE p.estado_pago END,
           proximo_vencimiento = CASE WHEN p.monto_abonado + c.abono >= p.monto_total THEN NULL
                                      ELSE (p.proximo_vencimiento + INTERVAL '1 month')::date END
       FROM (
         SELECT id_pago, LEAST(saldo, COALESCE($1::numeric,
                  CASE WHEN cuotas_pagadas + 1 >= num_cuotas THEN saldo
                       ELSE COALESCE(monto_cuota, ROUND(saldo / (num_cuotas - cuotas_pagadas), 2)) END)) AS abono
         FROM (SELECT *, monto_total - monto_abonado AS saldo FROM pagos WHERE id_pago = $2) s
       ) c
       WHERE p.id_pago = c.id_pago AND c.abono > 0
       RETURNING p.*`,
      [abono ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado o ya liquidado' });
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
  const { monto_total, monto_abonado, fecha_pago, metodo_pago, tipo_pago, estado_pago, num_control_responsable,
          num_cuotas, cuotas_pagadas, monto_cuota, proximo_vencimiento, notas } = req.body;
  if (num_cuotas !== undefined && (!Number.isInteger(num_cuotas) || num_cuotas < 1))
    return res.status(400).json({ error: 'Número de cuotas inválido' });
  try {
    const { rows } = await pool.query(
      `UPDATE pagos SET
         monto_total   = COALESCE($1, monto_total),
         monto_abonado = COALESCE($2, monto_abonado),
         fecha_pago    = COALESCE($3, fecha_pago),
         metodo_pago   = COALESCE($4, metodo_pago),
         tipo_pago     = COALESCE($5, tipo_pago),
         estado_pago   = COALESCE($6, estado_pago),
         num_control_responsable = COALESCE($7, num_control_responsable),
         num_cuotas     = COALESCE($9, num_cuotas),
         cuotas_pagadas = COALESCE($10, cuotas_pagadas),
         -- Estos tres se pueden vaciar: solo se conservan si no vienen en el body
         monto_cuota         = CASE WHEN $11::boolean THEN $12::numeric ELSE monto_cuota END,
         proximo_vencimiento = CASE WHEN $13::boolean THEN $14::date ELSE proximo_vencimiento END,
         notas               = CASE WHEN $15::boolean THEN $16::text ELSE notas END
       WHERE id_pago = $8
       RETURNING *`,
      [monto_total ?? null, monto_abonado ?? null, fecha_pago ?? null, metodo_pago ?? null,
       tipo_pago ?? null, estado_pago ?? null, num_control_responsable ?? null, req.params.id,
       num_cuotas ?? null, cuotas_pagadas ?? null,
       monto_cuota !== undefined, monto_cuota || null,
       proximo_vencimiento !== undefined, proximo_vencimiento || null,
       notas !== undefined, notas || null]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar pago', code: err.code, detalle: err.detail || err.message });
  }
});

module.exports = router;
