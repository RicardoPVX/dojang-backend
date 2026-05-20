const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const { auth } = require('../middleware/auth');

// POST /api/auth/login
// Body: { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Faltan credenciales' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE username = $1', [username]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const user = rows[0];
    const ok   = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    // Genera token con 8 horas de duración
    const token = jwt.sign(
      {
        id_usuario:  user.id_usuario,
        username:    user.username,
        rol:         user.rol,
        id_responsable: user.num_control_responsable,
        id_instructor:  user.id_instructor
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, rol: user.rol, username: user.username, nombre: user.nombre || user.username, id_instructor: user.id_instructor || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/cambiar-pass — alumno cambia su contraseña en primer acceso
router.post('/cambiar-pass', auth, async (req, res) => {
  const { nuevaPassword } = req.body;
  if (!nuevaPassword || nuevaPassword.length < 4)
    return res.status(400).json({ error: 'Contraseña muy corta' });
  try {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(nuevaPassword, 10);
    await pool.query(
      `UPDATE usuarios SET password=$1 WHERE username=$2`,
      [hash, req.user.username]
    );
    res.json({ ok: true });
  } catch(err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// PUT /api/auth/perfil — actualizar nombre del usuario
router.put('/perfil', auth, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || nombre.trim().length < 2)
    return res.status(400).json({ error: 'Nombre muy corto' });
  try {
    await pool.query(
      'UPDATE usuarios SET nombre=$1 WHERE id_usuario=$2',
      [nombre.trim(), req.user.id_usuario]
    );
    res.json({ ok: true, nombre: nombre.trim() });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

module.exports = router;
