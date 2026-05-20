const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, allow } = require('../middleware/auth');

// GET /api/lockers — todos los roles pueden ver
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT l.*, a.nombre AS alumno_nombre
      FROM lockers l
      LEFT JOIN alumnos a ON a.num_control = l.num_control_alumno
      ORDER BY l.numero_locker
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener lockers' });
  }
});

// POST /api/lockers — solo admin crea nuevos lockers
router.post('/', auth, allow('admin'), async (req, res) => {
  const { numero_locker, color } = req.body;
  if (!numero_locker)
    return res.status(400).json({ error: 'El número de locker es obligatorio' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO lockers (numero_locker, color)
       VALUES ($1, $2) RETURNING *`,
      [numero_locker, color || 'Gris']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Ese número de locker ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear locker' });
  }
});

// PUT /api/lockers/:id/asignar — alumno o admin asigna un locker a un alumno
router.put('/:id/asignar', auth, async (req, res) => {
  const { num_control_alumno } = req.body;
  if (!num_control_alumno)
    return res.status(400).json({ error: 'num_control_alumno es obligatorio' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que el locker existe y no esté tomado por otro
    const { rows: check } = await client.query(
      'SELECT * FROM lockers WHERE id_locker = $1', [req.params.id]
    );
    if (!check.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Locker no encontrado' });
    }
    if (check[0].num_control_alumno && check[0].num_control_alumno !== num_control_alumno) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Locker ya está ocupado por otro alumno' });
    }

    // Liberar cualquier locker previo del alumno
    await client.query(
      `UPDATE lockers
       SET num_control_alumno = NULL, fecha_asignacion = NULL
       WHERE num_control_alumno = $1`,
      [num_control_alumno]
    );

    // Asignar el nuevo locker
    const { rows } = await client.query(
      `UPDATE lockers
       SET num_control_alumno = $1, fecha_asignacion = CURRENT_DATE
       WHERE id_locker = $2 RETURNING *`,
      [num_control_alumno, req.params.id]
    );

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al asignar locker' });
  } finally {
    client.release();
  }
});

// PUT /api/lockers/:id/liberar — alumno libera su propio locker (o admin libera cualquiera)
router.put('/:id/liberar', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE lockers
       SET num_control_alumno = NULL, fecha_asignacion = NULL
       WHERE id_locker = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Locker no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al liberar locker' });
  }
});

// PUT /api/lockers/:id — admin edita datos del locker (número, color)
router.put('/:id', auth, allow('admin'), async (req, res) => {
  const { numero_locker, color } = req.body;
  if (!numero_locker)
    return res.status(400).json({ error: 'El número de locker es obligatorio' });
  try {
    const { rows } = await pool.query(
      `UPDATE lockers SET numero_locker = $1, color = $2
       WHERE id_locker = $3 RETURNING *`,
      [numero_locker, color || 'Gris', req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Locker no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Ese número de locker ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar locker' });
  }
});

// DELETE /api/lockers/:id — solo admin
router.delete('/:id', auth, allow('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM lockers WHERE id_locker = $1', [req.params.id]
    );
    if (!rowCount)
      return res.status(404).json({ error: 'Locker no encontrado' });
    res.json({ mensaje: 'Locker eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar locker' });
  }
});

module.exports = router;
