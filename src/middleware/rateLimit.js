// Limita intentos por IP en una ventana de tiempo (en memoria, suficiente para una sola instancia)
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();   // ip → { count, resetAt }

  return (req, res, next) => {
    const now = Date.now();
    const ip  = req.ip;   // real gracias a app.set('trust proxy', 1) en server.js
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

module.exports = { rateLimit };
