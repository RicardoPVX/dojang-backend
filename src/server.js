require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();
app.set('trust proxy', 1);   // Render está detrás de un proxy: req.ip = IP real del cliente

// ── Lista blanca de orígenes permitidos ───────────────────────
const ALLOWED_ORIGINS = [
  "https://dojang-tm69.vercel.app",
  "https://dojang-frontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:5500",
];

// ── Middlewares globales ──────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Permite peticiones sin origin (Postman, curl, health checks)
    if (!origin) return callback(null, true);
    // Permite cualquier subdominio de vercel.app (deployments preview)
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    // Permite pruebas locales en cualquier puerto
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    // Permite orígenes de la lista blanca
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origen no permitido → ' + origin));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Responder explícitamente a todos los preflight OPTIONS
app.options('*', cors());

app.use(express.json());            // parsear JSON en el body

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/alumnos',    require('./routes/alumnos'));
app.use('/api/pagos',      require('./routes/pagos'));
app.use('/api/examenes',   require('./routes/examenes'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/avances',    require('./routes/avances'));
app.use('/api/eventos',    require('./routes/eventos'));

// ── Ruta de salud (para que Render sepa que el server está vivo)
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Inicio ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🥋 Dojang API corriendo en http://localhost:${PORT}`)
);
