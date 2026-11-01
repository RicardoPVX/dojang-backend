const crypto = require('crypto');

// Sin letras ni números que se confundan al dictarla (0/O, 1/l/I)
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';

// Contraseña temporal aleatoria; se muestra una sola vez al admin y se cambia en el primer acceso
function generarPassTemporal(largo = 10) {
  let pass = '';
  for (let i = 0; i < largo; i++) pass += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return pass;
}

module.exports = { generarPassTemporal };
