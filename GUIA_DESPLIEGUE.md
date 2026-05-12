# GUÍA DE DESPLIEGUE — DOJANG TAEKWONDO
## Del código en tu PC → a internet gratis y para siempre

---

## PASO 1 — Supabase (Base de Datos PostgreSQL gratuita)

1. Ve a https://supabase.com y crea una cuenta gratuita
2. Clic en "New Project"
   - Organization: la que crea automáticamente
   - Name: `dojang-taekwondo`
   - Database Password: pon una contraseña fuerte (guárdala)
   - Region: US East (la más cercana a México con plan gratis)
3. Espera ~2 minutos a que se cree el proyecto
4. Ve a **SQL Editor** (menú izquierdo)
5. Pega TODO el contenido de `src/db/schema.sql` y ejecuta (botón Run)
   - Debes ver: "Success. No rows returned"
6. Ve a **Settings > Database**
   - Copia el campo: **Connection string > URI**
   - Se ve así: `postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres`
   - **Esta es tu DATABASE_URL**

---

## PASO 2 — Instalar Node.js en tu PC (si no lo tienes)

1. Ve a https://nodejs.org y descarga la versión LTS (la recomendada)
2. Instala normalmente, siguiente, siguiente, finalizar
3. Abre una terminal (cmd o PowerShell) y verifica:
   ```
   node --version    → debe decir v20.x.x o similar
   npm --version     → debe decir 10.x.x o similar
   ```

---

## PASO 3 — Configurar y probar en tu PC

1. Descomprime el ZIP del backend en una carpeta
2. Dentro de la carpeta, copia `.env.example` y renómbralo `.env`
3. Abre `.env` y llena con tus datos reales:
   ```
   DATABASE_URL=postgresql://postgres:[TU_PASSWORD]@db.[TU_REF].supabase.co:5432/postgres
   JWT_SECRET=escribe_cualquier_texto_largo_aqui_como_este_xd_abc123
   PORT=3001
   ```
4. Abre una terminal en la carpeta del proyecto y ejecuta:
   ```
   npm install
   npm run dev
   ```
5. Debes ver: `🥋 Dojang API corriendo en http://localhost:3001`
6. Prueba en el navegador: http://localhost:3001/health
   - Debe responder: `{"status":"ok"}`

### Probar el login (puedes usar el navegador o Postman):
```
POST http://localhost:3001/api/auth/login
Body JSON:
{
  "username": "admin",
  "password": "admin123"
}
```
Debe responder con un token JWT.

---

## PASO 4 — Subir a GitHub

1. Crea una cuenta en https://github.com si no tienes
2. Crea un repositorio nuevo llamado `dojang-backend`
   - Ponlo como **Private** (privado)
3. En tu PC, descarga e instala Git desde https://git-scm.com
4. En la carpeta del proyecto, ejecuta:
   ```
   git init
   git add .
   git commit -m "primer commit"
   git remote add origin https://github.com/TU_USUARIO/dojang-backend.git
   git push -u origin main
   ```
   **IMPORTANTE:** Verifica que el archivo `.env` NO se subió.
   El archivo `.gitignore` ya lo ignora automáticamente.

---

## PASO 5 — Desplegar el backend en Render (gratis)

1. Ve a https://render.com y crea cuenta con tu GitHub
2. Clic en "New +" > "Web Service"
3. Conecta tu repositorio `dojang-backend`
4. Configura:
   - Name: `dojang-api`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
5. En la sección "Environment Variables", agrega:
   - `DATABASE_URL` = (el valor de tu Supabase)
   - `JWT_SECRET` = (el mismo que pusiste en .env)
6. Clic en "Create Web Service"
7. Espera ~3 minutos. Render te dará una URL como:
   `https://dojang-api.onrender.com`
8. Prueba: `https://dojang-api.onrender.com/health` → debe responder `{"status":"ok"}`

**NOTA:** Con el plan gratuito de Render, el servidor "duerme" si no recibe
peticiones por 15 minutos. La primera petición tarda ~30 segundos en despertar.
Para el proyecto escolar está perfecto.

---

## PASO 6 — Conectar el Frontend (dojang.html)

Ahora debes modificar el HTML para que use la API real en vez de los datos falsos.

Busca en el HTML la función `createApi` o similar y reemplaza las llamadas
con fetch() a tu URL de Render.

Ejemplo de cómo cambiar una llamada:

```javascript
// ANTES (datos falsos en memoria):
const alumnos = INIT_DB.alumnos;

// DESPUÉS (datos reales de la API):
const API_URL = 'https://dojang-api.onrender.com';  // tu URL de Render

async function getAlumnos(token) {
  const res = await fetch(`${API_URL}/api/alumnos`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}
```

El token lo obtienes del login:
```javascript
async function login(username, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  return data.token;  // guarda esto en una variable
}
```

---

## PASO 7 — Subir el Frontend a Vercel (gratis)

1. Ve a https://vercel.com y crea cuenta con GitHub
2. Sube tu `dojang.html` a un repositorio de GitHub
3. En Vercel: "New Project" > conecta ese repositorio
4. Vercel detecta que es HTML estático y lo despliega solo
5. Te da una URL tipo: `https://dojang.vercel.app`

---

## RESUMEN DE ENDPOINTS DISPONIBLES

| Método | URL                         | Descripción                     | Quién puede |
|--------|-----------------------------|---------------------------------|-------------|
| POST   | /api/auth/login             | Iniciar sesión                  | Todos       |
| GET    | /api/alumnos                | Ver alumnos                     | Todos*      |
| POST   | /api/alumnos                | Registrar alumno                | Admin/Inst. |
| PUT    | /api/alumnos/:id            | Actualizar alumno               | Admin/Inst. |
| DELETE | /api/alumnos/:id            | Eliminar alumno                 | Solo Admin  |
| GET    | /api/pagos                  | Ver pagos                       | Todos*      |
| POST   | /api/pagos                  | Registrar pago                  | Admin/Inst. |
| PUT    | /api/pagos/:id/abonar       | Registrar abono parcial         | Solo Admin  |
| GET    | /api/examenes               | Ver exámenes                    | Todos*      |
| POST   | /api/examenes               | Registrar examen                | Admin/Inst. |
| PUT    | /api/examenes/:id           | Actualizar resultado            | Admin/Inst. |
| GET    | /api/inventario             | Ver inventario                  | Todos*      |
| POST   | /api/inventario             | Agregar artículo                | Solo Admin  |
| PUT    | /api/inventario/:id         | Actualizar stock                | Admin/Inst. |
| GET    | /api/avances                | Ver avances/observaciones       | Todos*      |
| POST   | /api/avances                | Registrar avance                | Admin/Inst. |

*Todos = autenticados; responsable solo ve sus propios datos.

---

## Credenciales por defecto

- Usuario: `admin`
- Contraseña: `admin123`

**Cámbialas después de probar.** Para crear más usuarios, inserta en la tabla
`usuarios` con la contraseña hasheada con bcrypt.
