-- ============================================================
-- MIGRACIÓN FASE 1 — Portal para padres
-- Ejecuta este archivo en Supabase > SQL Editor (es seguro correrlo más de una vez)
-- ============================================================

-- Eventos de la escuela (la ruta /api/eventos ya existía pero no estaba conectada)
CREATE TABLE IF NOT EXISTS eventos (
    id_evento   SERIAL PRIMARY KEY,
    titulo      VARCHAR(150) NOT NULL,
    tipo        VARCHAR(20)  DEFAULT 'especial',  -- 'ascenso' | 'torneo' | 'especial'
    fecha       DATE NOT NULL,
    lugar       VARCHAR(150),
    descripcion TEXT
);
