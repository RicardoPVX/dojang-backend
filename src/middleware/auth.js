const jwt = require('jsonwebtoken');

// Verifica que el token JWT sea válido
function auth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Sin token' });

  const token = header.split(' ')[1];   // "Bearer <token>"
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Solo permite ciertos roles
function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol))
      return res.status(403).json({ error: 'Sin permiso para esta acción' });
    next();
  };
}

module.exports = { auth, allow };
