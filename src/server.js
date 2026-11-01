require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();
app.set('trust proxy', 1);   // Render está detrás de un proxy: req.ip = IP real del cliente

// ── Middlewares globales ──────────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    // Permite cualquier subdominio de vercel.app, localhost (cualquier puerto) y sin origen (Postman, etc.)
    if (!origin) return callback(null, true);
    if (
      origin.endsWith('.vercel.app') ||
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
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
app.use('/api/dudas', require('./routes/dudas'));
app.use('/api/lockers',     require('./routes/lockers'));
app.use('/api/sedes',       require('./routes/sedes'));
app.use('/api/equipo',     require('./routes/equipo'));
app.use('/api/eventos',    require('./routes/eventos'));

// ── Ruta de salud
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ── Inicio ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🥋 Dojang API corriendo en http://localhost:${PORT}`)
);
