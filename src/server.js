require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ── Middlewares globales ──────────────────────────────────────
app.use(cors({
  origin: ["https://dojang-frontend.vercel.app", "http://localhost:3001", "http://127.0.0.1:5500"],
  methods: ["GET","POST","PUT","DELETE"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/alumnos',      require('./routes/alumnos'));
app.use('/api/pagos',        require('./routes/pagos'));
app.use('/api/examenes',     require('./routes/examenes'));
app.use('/api/inventario',   require('./routes/inventario'));
app.use('/api/avances',      require('./routes/avances'));
app.use('/api/torneos',      require('./routes/torneos'));
app.use('/api/clases',       require('./routes/clases'));
app.use('/api/instructores', require('./routes/instructores'));

// ── Ruta de salud
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ── Inicio ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🥋 Dojang API corriendo en http://localhost:${PORT}`)
);
