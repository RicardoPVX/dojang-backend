require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ── Middlewares globales ──────────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    // Permite cualquier subdominio de vercel.app, localhost y sin origen (Postman, etc.)
    if (!origin) return callback(null, true);
    if (
      origin.endsWith('.vercel.app') ||
      origin === 'http://localhost:3001' ||
      origin === 'http://localhost:5500' ||
      origin === 'http://127.0.0.1:5500'
    ) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true
}));
app.options('*', cors());
app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/alumnos',    require('./routes/alumnos'));
app.use('/api/pagos',      require('./routes/pagos'));
app.use('/api/examenes',   require('./routes/examenes'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/avances',    require('./routes/avances'));
app.use('/api/torneos',    require('./routes/torneos'));
app.use('/api/clases',     require('./routes/clases'));
app.use('/api/instructores', require('./routes/instructores'));
app.use('/api/equipo',     require('./routes/equipo'));

// ── Ruta de salud
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ── Inicio ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🥋 Dojang API corriendo en http://localhost:${PORT}`)
);
