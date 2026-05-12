const pool = require('../db/pool');

const BASE_QUERY = `
  SELECT p.*, r.nombre AS responsable_nombre
  FROM pagos p
  JOIN responsables r ON r.num_control = p.num_control_responsable`;

// Devuelve todos los pagos (admin) o solo los del responsable autenticado
async function getAll(user) {
  if (user.rol === 'responsable') {
    const { rows } = await pool.query(
      BASE_QUERY + ` WHERE p.num_control_responsable = $1 ORDER BY p.fecha_pago DESC`,
      [user.id_responsable]
    );
    return rows;
  }
  const { rows } = await pool.query(BASE_QUERY + ` ORDER BY p.fecha_pago DESC`);
  return rows;
}

// Registra un pago; si es Mensualidad y se envía mes_correspondiente, crea el detalle
async function create(data) {
  const {
    monto_total, monto_abonado = 0, fecha_pago, metodo_pago,
    tipo_pago, estado_pago = 'Pendiente', num_control_responsable,
    mes_correspondiente, anio
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO pagos (monto_total, monto_abonado, fecha_pago, metodo_pago,
      tipo_pago, estado_pago, num_control_responsable)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [monto_total, monto_abonado,
     fecha_pago || new Date().toISOString().split('T')[0],
     metodo_pago, tipo_pago, estado_pago, num_control_responsable]
  );
  const pago = rows[0];

  if (tipo_pago === 'Mensualidad' && mes_correspondiente) {
    await pool.query(
      `INSERT INTO mensualidades (id_pago, mes_correspondiente, anio) VALUES ($1,$2,$3)`,
      [pago.id_pago, mes_correspondiente, anio || new Date().getFullYear()]
    );
  }

  return pago;
}

// Aplica un abono parcial; actualiza estado a 'Liquidado' si el total es cubierto
async function abonar(id, abono) {
  const { rows } = await pool.query(
    `UPDATE pagos
     SET monto_abonado = monto_abonado + $1,
         estado_pago = CASE WHEN monto_abonado + $1 >= monto_total THEN 'Liquidado' ELSE estado_pago END
     WHERE id_pago = $2 RETURNING *`,
    [abono, id]
  );
  return rows[0] || null;
}

module.exports = { getAll, create, abonar };
