const Auth = require('../models/auth.model');

// POST /api/auth/login
async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Faltan credenciales' });

  try {
    const user = await Auth.findByCredentials(username, password);
    if (!user)
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const token = Auth.generateToken(user);
    res.json({ token, rol: user.rol, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
}

// POST /api/auth/cambiar-pass — requiere token válido
async function cambiarPass(req, res) {
  const { nuevaPassword } = req.body;
  if (!nuevaPassword || nuevaPassword.length < 6)
    return res.status(400).json({ error: 'Contraseña muy corta' });

  try {
    await Auth.cambiarPassword(req.user.username, nuevaPassword);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
}

module.exports = { login, cambiarPass };
