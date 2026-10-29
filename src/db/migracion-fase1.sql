-- ============================================================
-- MIGRACIÓN FASE 1 — Portal para padres
-- Ejecuta este archivo en Supabase > SQL Editor (es seguro correrlo más de una vez)
-- ============================================================

-- Datos personales y médicos del alumno (los edita el padre desde el portal)
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS email               VARCHAR(100);
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS direccion           TEXT;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS tipo_sangre         VARCHAR(5);
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS contacto_emergencia VARCHAR(100);
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS tel_emergencia      VARCHAR(20);
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS notas_medicas       TEXT;

-- Eventos de la escuela (exámenes de ascenso, torneos, especiales)
CREATE TABLE IF NOT EXISTS eventos (
    id_evento   SERIAL PRIMARY KEY,
    titulo      VARCHAR(150) NOT NULL,
    tipo        VARCHAR(20)  DEFAULT 'especial',  -- 'ascenso' | 'torneo' | 'especial'
    fecha       DATE NOT NULL,
    descripcion TEXT,
    lugar       VARCHAR(150)
);
