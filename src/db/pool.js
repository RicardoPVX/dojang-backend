const { Pool } = require('pg');
require('dotenv').config();

// Postgres local (pruebas en tu PC) no usa SSL; Supabase / Render sí
const esLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: esLocal ? false : { rejectUnauthorized: false }
});

module.exports = pool;
