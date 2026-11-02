const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// Deja rastro de cada movimiento de dinero; recibe el pool o una transacción abierta
function registrar(db, user, { id_pago, num_control_alumno, tipo, monto, concepto }) {
  return db.query(
    `INSERT INTO movimientos_pago (id_pago, num_control_alumno, tipo, monto, concepto, usuario)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id_pago, num_control_alumno || null, tipo, monto ?? null, concepto || null, user.username]
  );
}

// GET /api/pagos  — admin ve todos; responsable solo los suyos
router.get('/', auth, async (req, res) => {
  try {
    let query, params = [];
    if (req.user.rol === 'responsable') {
      query = `SELECT p.*, r.nombre AS responsable_nombre,
                      m.mes_correspondiente, m.anio AS anio_correspondiente
               FROM pagos p JOIN responsables r ON r.num_control = p.num_control_responsable
               LEFT JOIN mensualidades m ON m.id_pago = p.id_pago
               WHERE p.num_control_responsable = $1 ORDER BY p.fecha_pago DESC`;
      params = [req.user.num_control_responsable || req.user.id_responsable];
    } else {
      query = `SELECT p.*, r.nombre AS responsable_nombre,
                      m.mes_correspondiente, m.anio AS anio_correspondiente
               FROM pagos p JOIN responsables r ON r.num_control = p.num_control_responsable
               LEFT JOIN mensualidades m ON m.id_pago = p.id_pago
               ORDER BY p.fecha_pago DESC`;
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// GET /api/pagos/movimientos — los últimos 100 movimientos de dinero
router.get('/movimientos', auth, allow('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, a.nombre AS alumno_nombre
       FROM movimientos_pago m
       LEFT JOIN alumnos a ON a.num_control = m.num_control_alumno
       ORDER BY m.fecha DESC, m.id_movimiento DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

// POST /api/pagos  — registrar pago (mensualidad, equipo, examen…)
router.post('/', auth, allow('admin'), async (req, res) => {
  const { monto_total, monto_abonado = 0, fecha_pago, metodo_pago,
          tipo_pago, estado_pago = 'Pendiente', num_control_responsable,
          num_cuotas = 1, cuotas_pagadas, monto_cuota, proximo_vencimiento, notas, num_control_alumno } = req.body;

  if (!monto_total || !tipo_pago || !num_control_responsable)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (!Number.isInteger(num_cuotas) || num_cuotas < 1)
    return res.status(400).json({ error: 'Número de cuotas inválido' });

  const esMensualidad = tipo_pago === 'Mensualidad' && req.body.mes_correspondiente;
  const anio = req.body.anio || new Date().getFullYear();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Una mensualidad se cobra una sola vez, aunque dos dispositivos o un reintento la manden a la vez
    if (esMensualidad && num_control_alumno) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
        [`${num_control_alumno}:${req.body.mes_correspondiente}:${anio}`]);
      const { rows: ya } = await client.query(
        `SELECT p.* FROM pagos p JOIN mensualidades m ON m.id_pago = p.id_pago
         WHERE p.num_control_alumno = $1 AND m.mes_correspondiente = $2 AND m.anio = $3 LIMIT 1`,
        [num_control_alumno, String(req.body.mes_correspondiente), anio]
      );
      if (ya.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Esa mensualidad ya está cobrada', pago: ya[0] });
      }
    }

    const { rows } = await client.query(
      `INSERT INTO pagos (monto_total, monto_abonado, fecha_pago, metodo_pago,
        tipo_pago, estado_pago, num_control_responsable,
        num_cuotas, cuotas_pagadas, monto_cuota, proximo_vencimiento, notas, num_control_alumno)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [monto_total, monto_abonado, fecha_pago || new Date().toISOString().split('T')[0],
       metodo_pago, tipo_pago, estado_pago, num_control_responsable,
       num_cuotas, cuotas_pagadas ?? (estado_pago === 'Liquidado' ? num_cuotas : 0),
       monto_cuota || null, proximo_vencimiento || null, notas || null, num_control_alumno || null]
    );

    // Si es mensualidad, crear detalle automáticamente
    if (esMensualidad) {
      await client.query(
        `INSERT INTO mensualidades (id_pago, mes_correspondiente, anio)
         VALUES ($1,$2,$3)`,
        [rows[0].id_pago, req.body.mes_correspondiente, anio]
      );
    }
    await registrar(client, req.user, {
      id_pago: rows[0].id_pago, num_control_alumno, tipo: 'cobro',
      monto: monto_abonado, concepto: esMensualidad ? `Mensualidad ${req.body.mes_correspondiente}/${anio}` : tipo_pago
    });

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al registrar pago', code: err.code, detalle: err.detail || err.message });
  } finally {
    client.release();
  }
});

// PUT /api/pagos/:id/abonar  — registra un abono por el monto indicado. Nunca se abona de más del saldo.
// Sin "abono" en el body, usa la cuota del plan (planes creados antes de los abonos libres).
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
                                      ELSE p.proximo_vencimiento END
       FROM (
         SELECT id_pago, LEAST(saldo, COALESCE($1::numeric,
                  CASE WHEN cuotas_pagadas + 1 >= num_cuotas THEN saldo
                       ELSE COALESCE(monto_cuota, ROUND(saldo / (num_cuotas - cuotas_pagadas), 2)) END)) AS abono
         FROM (SELECT *, monto_total - monto_abonado AS saldo FROM pagos WHERE id_pago = $2) s
       ) c
       WHERE p.id_pago = c.id_pago AND c.abono > 0
       RETURNING p.*, c.abono AS abono_aplicado`,
      [abono ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado o ya liquidado' });
    await registrar(pool, req.user, {
      id_pago: rows[0].id_pago, num_control_alumno: rows[0].num_control_alumno,
      tipo: 'abono', monto: rows[0].abono_aplicado, concepto: rows[0].tipo_pago
    });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar abono' });
  }
});

// PUT /api/pagos/:id/revertir-abono — deshace un abono recién registrado, sobre lo que haya en ese momento
router.put('/:id/revertir-abono', auth, allow('admin'), async (req, res) => {
  const abono = parseFloat(req.body.abono);
  if (!abono || abono <= 0)
    return res.status(400).json({ error: 'Abono inválido' });

  try {
    const { rows } = await pool.query(
      `UPDATE pagos
       SET monto_abonado  = monto_abonado - $1::numeric,
           cuotas_pagadas = GREATEST(cuotas_pagadas - 1, 0),
           estado_pago    = CASE WHEN monto_abonado - $1::numeric < monto_total THEN 'Pendiente' ELSE estado_pago END
       WHERE id_pago = $2 AND monto_abonado >= $1::numeric
       RETURNING *`,
      [abono, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado o abono mayor a lo pagado' });
    await registrar(pool, req.user, {
      id_pago: rows[0].id_pago, num_control_alumno: rows[0].num_control_alumno,
      tipo: 'abono_revertido', monto: abono, concepto: rows[0].tipo_pago
    });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al revertir abono' });
  }
});

// DELETE /api/pagos/:id
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    // Eliminar mensualidad asociada si existe
    await pool.query('DELETE FROM mensualidades WHERE id_pago = $1', [req.params.id]);
    const { rows } = await pool.query(
      'DELETE FROM pagos WHERE id_pago = $1 RETURNING *', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado' });
    await registrar(pool, req.user, {
      id_pago: rows[0].id_pago, num_control_alumno: rows[0].num_control_alumno,
      tipo: 'eliminacion', monto: rows[0].monto_abonado, concepto: rows[0].tipo_pago
    });
    res.json({ mensaje: 'Pago eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar pago' });
  }
});

// PUT /api/pagos/:id — editar pago
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { monto_total, monto_abonado, fecha_pago, metodo_pago, tipo_pago, estado_pago, num_control_responsable,
          num_cuotas, cuotas_pagadas, monto_cuota, proximo_vencimiento, notas, num_control_alumno } = req.body;
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
         num_control_alumno = COALESCE($17, num_control_alumno),
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
       notas !== undefined, notas || null, num_control_alumno ?? null]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado' });
    await registrar(pool, req.user, {
      id_pago: rows[0].id_pago, num_control_alumno: rows[0].num_control_alumno,
      tipo: 'edicion', monto: rows[0].monto_total, concepto: rows[0].tipo_pago
    });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar pago', code: err.code, detalle: err.detail || err.message });
  }
});

module.exports = router;
