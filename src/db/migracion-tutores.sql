-- ============================================================
-- MIGRACIÓN — Cuenta única por tutor, pagos por alumno, grados y eventos generales
-- Es seguro correrlo más de una vez
-- ============================================================

-- Parentesco del tutor con cada alumno (un tutor puede tener varios alumnos)
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS parentesco VARCHAR(30);

-- Cada pago pertenece a un alumno: con varios hijos en una cuenta ya no basta con el tutor.
-- Sin llave foránea a propósito: el pago se conserva como historial si el alumno se da de baja.
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS num_control_alumno VARCHAR(20);
UPDATE pagos p SET num_control_alumno = a.num_control
  FROM alumnos a
 WHERE p.num_control_alumno IS NULL
   AND a.num_control_responsable = p.num_control_responsable
   AND (SELECT count(*) FROM alumnos x WHERE x.num_control_responsable = p.num_control_responsable) = 1;

-- Sistema de grados Moo Duk Kwan: los 8 existentes conservan su id; se agregan los intermedios
INSERT INTO cintas (id_cinta, color, nombre_grado, categoria) VALUES
  (1,  'Blanco',           'Blanco',               'Principiantes'),
  (2,  'Amarillo',         '10 Kup',               'Principiantes'),
  (3,  'Naranja',          '9 Kup',                'Principiantes'),
  (9,  'Naranja Avanzado', '8 Kup',                'Principiantes'),
  (4,  'Verde',            '7 Kup',                'Principiantes'),
  (10, 'Verde Avanzado',   '6 Kup',                'Principiantes'),
  (5,  'Azul',             '5 Kup',                'Intermedios'),
  (11, 'Azul Avanzado',    '4 Kup',                'Intermedios'),
  (6,  'Marrón',           '3 Kup',                'Intermedios'),
  (12, 'Marrón Avanzado',  '2 Kup',                'Avanzados'),
  (7,  'Rojo',             '1 Kup',                'Avanzados'),
  (13, 'Rojo Avanzado',    'Ieby Poom / Ieby Dan', 'Avanzados'),
  (8,  'Negro',            'Cinta Negra',          'Cinta Negra')
ON CONFLICT (id_cinta) DO UPDATE
  SET color = EXCLUDED.color, nombre_grado = EXCLUDED.nombre_grado, categoria = EXCLUDED.categoria;
SELECT setval(pg_get_serial_sequence('cintas', 'id_cinta'), (SELECT MAX(id_cinta) FROM cintas));

-- Eventos generales: Examen, Torneo, Fogueo u Otro
UPDATE eventos SET tipo = 'examen' WHERE tipo = 'ascenso';
UPDATE eventos SET tipo = 'otro'   WHERE tipo = 'especial' OR tipo IS NULL;

-- Exámenes grupales futuros: pasan a la agenda única
INSERT INTO eventos (titulo, tipo, fecha, lugar)
SELECT COALESCE(NULLIF(e.nombre_examen, ''), 'Examen'), 'examen', e.fecha, e.sede
  FROM examenes e
 WHERE e.num_control_alumno IS NULL AND e.id_pago IS NULL AND e.fecha >= CURRENT_DATE
   AND NOT EXISTS (SELECT 1 FROM eventos v
                    WHERE v.tipo = 'examen' AND v.fecha = e.fecha
                      AND v.titulo = COALESCE(NULLIF(e.nombre_examen, ''), 'Examen'));
