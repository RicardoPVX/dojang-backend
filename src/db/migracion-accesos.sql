-- ============================================================
-- MIGRACIÓN — Accesos de padres y avances
-- Es seguro correrlo más de una vez
-- ============================================================

-- Marca las cuentas que entran con contraseña temporal y deben cambiarla
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar BOOLEAN NOT NULL DEFAULT false;

-- Avances: observaciones del instructor por alumno (la tabla no existía en la base real)
CREATE TABLE IF NOT EXISTS avances (
    id_avance          SERIAL PRIMARY KEY,
    fecha              DATE DEFAULT CURRENT_DATE,
    observacion        TEXT NOT NULL,
    num_control_alumno VARCHAR(20) NOT NULL REFERENCES alumnos(num_control),
    id_instructor      INT NOT NULL REFERENCES instructores(id_instructor)
);
ALTER TABLE avances ENABLE ROW LEVEL SECURITY;
