const pool   = require('../db/pool');
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');

// Busca un usuario por username y valida su contraseña; devuelve el user o null
async function findByCredentials(username, password) {
  const { rows } = await pool.query(
    'SELECT * FROM usuarios WHERE username = $1', [username]
  );
  if (!rows.length) return null;

  const user = rows[0];
  const ok   = await bcrypt.compare(password, user.password);
  if (!ok) return null;

  return user;
}

// Genera un JWT firmado con los datos del usuario
function generateToken(user) {
  return jwt.sign(
    {
      id_usuario:     user.id_usuario,
      username:       user.username,
      rol:            user.rol,
      id_responsable: user.num_control_responsable,
      id_instructor:  user.id_instructor
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

// Cambia la contraseña de un usuario (recibe username y nueva contraseña en texto plano)
async function cambiarPassword(username, nuevaPassword) {
  const hash = await bcrypt.hash(nuevaPassword, 10);
  await pool.query(
    `UPDATE usuarios SET password=$1 WHERE username=$2`,
    [hash, username]
  );
}

module.exports = { findByCredentials, generateToken, cambiarPassword };
