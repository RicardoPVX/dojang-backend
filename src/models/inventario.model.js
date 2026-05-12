const pool = require('../db/pool');

// Devuelve todos los artículos con su estado de stock calculado
async function getAll() {
  const { rows } = await pool.query(`
    SELECT *,
      CASE
        WHEN stock = 0 THEN 'sin_stock'
        WHEN stock <= stock_minimo THEN 'bajo'
        ELSE 'ok'
      END AS estado_stock
    FROM equipo ORDER BY descripcion
  `);
  return rows;
}

// Crea un nuevo artículo en el inventario
async function create({ descripcion, talla_modelo, precio_unitario, stock = 0, stock_minimo = 2 }) {
  const { rows } = await pool.query(
    `INSERT INTO equipo (descripcion, talla_modelo, precio_unitario, stock, stock_minimo)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [descripcion, talla_modelo, precio_unitario, stock, stock_minimo]
  );
  return rows[0];
}

// Actualiza los datos de un artículo existente
async function update(id, { descripcion, talla_modelo, precio_unitario, stock, stock_minimo }) {
  const { rows } = await pool.query(
    `UPDATE equipo SET descripcion=$1, talla_modelo=$2, precio_unitario=$3,
      stock=$4, stock_minimo=$5
     WHERE id_articulo=$6 RETURNING *`,
    [descripcion, talla_modelo, precio_unitario, stock, stock_minimo, id]
  );
  return rows[0] || null;
}

// Elimina un artículo por su id
async function remove(id) {
  await pool.query('DELETE FROM equipo WHERE id_articulo=$1', [id]);
}

module.exports = { getAll, create, update, remove };
