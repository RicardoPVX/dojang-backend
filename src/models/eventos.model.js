const pool = require('../db/pool');

// Devuelve todos los eventos ordenados por fecha
async function getAll() {
  const { rows } = await pool.query(`SELECT * FROM eventos ORDER BY fecha`);
  return rows;
}

// Crea un evento
async function create({ titulo, tipo, fecha, descripcion, lugar }) {
  const { rows } = await pool.query(
    `INSERT INTO eventos (titulo, tipo, fecha, descripcion, lugar)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [titulo, tipo || 'especial', fecha, descripcion || null, lugar || null]
  );
  return rows[0];
}

// Actualiza un evento
async function update(id, { titulo, tipo, fecha, descripcion, lugar }) {
  const { rows } = await pool.query(
    `UPDATE eventos SET titulo=$1, tipo=$2, fecha=$3, descripcion=$4, lugar=$5
     WHERE id_evento=$6 RETURNING *`,
    [titulo, tipo || 'especial', fecha, descripcion || null, lugar || null, id]
  );
  return rows[0] || null;
}

// Elimina un evento
async function remove(id) {
  const { rowCount } = await pool.query(`DELETE FROM eventos WHERE id_evento=$1`, [id]);
  return rowCount > 0;
}

module.exports = { getAll, create, update, remove };
