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

-- Planes de pago: cuotas, vencimiento y notas ahora se guardan
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS num_cuotas          INT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS cuotas_pagadas      INT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_cuota         DECIMAL(10,2);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS proximo_vencimiento DATE;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS notas               TEXT;

-- Pagos que ya existían: antes todo plan a plazos se mostraba con 4 cuotas, se conserva ese dato
UPDATE pagos
   SET num_cuotas  = CASE WHEN metodo_pago = 'A plazos' THEN 4 ELSE 1 END,
       monto_cuota = ROUND(monto_total / CASE WHEN metodo_pago = 'A plazos' THEN 4 ELSE 1 END, 2)
 WHERE num_cuotas IS NULL;

UPDATE pagos
   SET cuotas_pagadas = CASE WHEN estado_pago = 'Liquidado' OR monto_abonado >= monto_total THEN num_cuotas
                             ELSE LEAST(FLOOR(COALESCE(monto_abonado, 0) / NULLIF(monto_cuota, 0))::int, num_cuotas) END
 WHERE cuotas_pagadas IS NULL;
UPDATE pagos SET cuotas_pagadas = 0 WHERE cuotas_pagadas IS NULL;

ALTER TABLE pagos ALTER COLUMN num_cuotas SET DEFAULT 1;
ALTER TABLE pagos ALTER COLUMN num_cuotas SET NOT NULL;
ALTER TABLE pagos ALTER COLUMN cuotas_pagadas SET DEFAULT 0;
ALTER TABLE pagos ALTER COLUMN cuotas_pagadas SET NOT NULL;
