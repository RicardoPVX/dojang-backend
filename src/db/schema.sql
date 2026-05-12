-- ============================================================
-- SISTEMA DE ADMINISTRACIÓN — DOJANG TAEKWONDO
-- Ejecuta este archivo completo en Supabase > SQL Editor
-- ============================================================

-- 1. CINTAS
CREATE TABLE cintas (
    id_cinta    SERIAL PRIMARY KEY,
    color       VARCHAR(30)  NOT NULL,
    nombre_grado VARCHAR(50) NOT NULL,
    categoria   VARCHAR(30)
);

-- 2. INSTRUCTORES
CREATE TABLE instructores (
    id_instructor SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    cargo         VARCHAR(100),
    grado_cinta   VARCHAR(50)
);

-- 3. RESPONSABLES
CREATE TABLE responsables (
    num_control VARCHAR(20) PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    telefono    VARCHAR(20),
    direccion   TEXT
);

-- 4. ALUMNOS
CREATE TABLE alumnos (
    num_control              VARCHAR(20) PRIMARY KEY,
    nombre                   VARCHAR(100) NOT NULL,
    fecha_nacimiento         DATE NOT NULL,
    fecha_ingreso            DATE DEFAULT CURRENT_DATE,
    id_cinta_actual          INT  NOT NULL REFERENCES cintas(id_cinta),
    num_control_responsable  VARCHAR(20) NOT NULL REFERENCES responsables(num_control)
);

-- 5. CLASES
CREATE TABLE clases (
    id_clase      SERIAL PRIMARY KEY,
    dia_semana    VARCHAR(15) NOT NULL,
    hora_inicio   TIME NOT NULL,
    hora_fin      TIME NOT NULL,
    id_instructor INT  NOT NULL REFERENCES instructores(id_instructor)
);

-- 6. INSCRIPCIONES (alumno ↔ clase)
CREATE TABLE inscripciones (
    id_inscripcion    SERIAL PRIMARY KEY,
    num_control_alumno VARCHAR(20) NOT NULL REFERENCES alumnos(num_control),
    id_clase           INT NOT NULL REFERENCES clases(id_clase),
    fecha_ins          DATE DEFAULT CURRENT_DATE,
    UNIQUE (num_control_alumno, id_clase)
);

-- 7. PAGOS  (central, cubre mensualidades, equipo, exámenes, torneos)
CREATE TABLE pagos (
    id_pago                  SERIAL PRIMARY KEY,
    monto_total              DECIMAL(10,2) NOT NULL,
    monto_abonado            DECIMAL(10,2) DEFAULT 0,
    fecha_pago               DATE DEFAULT CURRENT_DATE,
    metodo_pago              VARCHAR(50),   -- 'Contado' | 'A plazos'
    tipo_pago                VARCHAR(50),   -- 'Mensualidad' | 'Equipo' | 'Examen' | 'Torneo'
    estado_pago              VARCHAR(20) DEFAULT 'Pendiente', -- 'Pendiente' | 'Liquidado' | 'Vencido'
    num_control_responsable  VARCHAR(20) NOT NULL REFERENCES responsables(num_control)
);

-- 8. MENSUALIDADES  (detalle de un pago tipo Mensualidad)
CREATE TABLE mensualidades (
    id_mensualidad  SERIAL PRIMARY KEY,
    id_pago         INT NOT NULL REFERENCES pagos(id_pago),
    mes_correspondiente VARCHAR(20),   -- 'Enero', 'Febrero', …
    anio            INT
);

-- 9. EQUIPO  (catálogo / inventario)
CREATE TABLE equipo (
    id_articulo      SERIAL PRIMARY KEY,
    descripcion      VARCHAR(100) NOT NULL,
    talla_modelo     VARCHAR(50),
    precio_unitario  DECIMAL(10,2) NOT NULL,
    stock            INT DEFAULT 0,
    stock_minimo     INT DEFAULT 2
);

-- 10. TORNEOS
CREATE TABLE torneos (
    id_torneo          SERIAL PRIMARY KEY,
    nombre_torneo      VARCHAR(100),
    sede               VARCHAR(100),
    fecha              DATE,
    id_pago            INT  NOT NULL REFERENCES pagos(id_pago),
    num_control_alumno VARCHAR(20) NOT NULL REFERENCES alumnos(num_control)
);

-- 11. EXÁMENES
CREATE TABLE examenes (
    id_examen          SERIAL PRIMARY KEY,
    fecha              DATE,
    observaciones      TEXT,
    resultado          VARCHAR(20) DEFAULT 'Pendiente', -- 'Aprobado' | 'Reprobado' | 'Pendiente'
    bimestre           VARCHAR(20),
    num_control_alumno VARCHAR(20) NOT NULL REFERENCES alumnos(num_control),
    id_cinta_aspirada  INT NOT NULL REFERENCES cintas(id_cinta),
    id_pago            INT REFERENCES pagos(id_pago)   -- puede no requerir pago
);

-- 12. AVANCES  (observaciones del instructor por sesión)
CREATE TABLE avances (
    id_avance          SERIAL PRIMARY KEY,
    fecha              DATE DEFAULT CURRENT_DATE,
    observacion        TEXT NOT NULL,
    num_control_alumno VARCHAR(20) NOT NULL REFERENCES alumnos(num_control),
    id_instructor      INT NOT NULL REFERENCES instructores(id_instructor)
);

-- 13. USUARIOS  (login del sistema)
CREATE TABLE usuarios (
    id_usuario  SERIAL PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,   -- bcrypt hash
    rol         VARCHAR(20) NOT NULL,    -- 'admin' | 'instructor' | 'responsable'
    -- Una de estas dos será NOT NULL según el rol:
    num_control_responsable VARCHAR(20) REFERENCES responsables(num_control),
    id_instructor           INT         REFERENCES instructores(id_instructor)
);

-- ============================================================
-- DATOS SEMILLA (para probar rápido)
-- ============================================================
INSERT INTO cintas (color, nombre_grado, categoria) VALUES
  ('Blanco',   'Blanco',           'Principiante'),
  ('Amarillo', 'Amarillo',         'Principiante'),
  ('Naranja',  'Naranja',          'Intermedio'),
  ('Verde',    'Verde',            'Intermedio'),
  ('Azul',     'Azul',             'Avanzado'),
  ('Morado',   'Morado',           'Avanzado'),
  ('Rojo',     'Rojo',             'Avanzado'),
  ('Negro',    'Negro 1er Dan',    'Dan');

INSERT INTO instructores (nombre, cargo, grado_cinta) VALUES
  ('Ricardo', 'Maestro Principal / Dueño', 'Negro');

-- Usuario admin por defecto  (password: admin123 — cámbiala después)
-- El hash abajo corresponde a "admin123" con bcrypt 10 rounds
INSERT INTO usuarios (username, password, rol) VALUES
  ('admin', '$2b$10$YKG2OdBmCmFmSIbmFQ1cLuqLQxGlpjVK3I5X/6Hm8UlPjJ9mHvECW', 'admin');
