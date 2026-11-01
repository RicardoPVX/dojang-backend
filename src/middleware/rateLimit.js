// Limita intentos fallidos por IP en una ventana de tiempo (en memoria, suficiente para una sola instancia).
// Los exitosos no cuentan, para que varias familias en el mismo internet no se bloqueen entre sí.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();   // ip → { count, resetAt }

  return (req, res, next) => {
    const now = Date.now();
    // Render está detrás de Cloudflare, que es quien conoce la IP real del cliente
    const ip  = req.headers['cf-connecting-ip'] || req.ip;
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
    res.on('finish', () => { if (res.statusCode < 400) entry.count--; });
    next();
  };
}

module.exports = { rateLimit };
