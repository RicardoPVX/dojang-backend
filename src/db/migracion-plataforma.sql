-- ============================================================
-- MIGRACIÓN — Plataforma nueva: registro de movimientos y dudas por alumno
-- Solo agrega; no cambia ni borra datos. Es seguro correrlo más de una vez.
-- Se corre ANTES de publicar el backend de esta rama.
-- ============================================================

-- Cada cobro, abono o corrección deja rastro: "deshacer" quita el pago, no la historia.
-- Sin llaves foráneas a propósito: el registro sobrevive al pago y al alumno.
CREATE TABLE IF NOT EXISTS movimientos_pago (
  id_movimiento       SERIAL PRIMARY KEY,
  id_pago             INTEGER,
  num_control_alumno  VARCHAR(20),
  tipo                VARCHAR(20) NOT NULL,   -- cobro | abono | abono_revertido | edicion | eliminacion
  monto               NUMERIC(10,2),
  concepto            VARCHAR(120),
  usuario             VARCHAR(50),
  fecha               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS movimientos_pago_fecha_idx ON movimientos_pago (fecha DESC);
ALTER TABLE movimientos_pago ENABLE ROW LEVEL SECURITY;

-- De qué hijo trata cada duda (las anteriores se quedan sin alumno)
ALTER TABLE dudas ADD COLUMN IF NOT EXISTS num_control_alumno VARCHAR(20);
