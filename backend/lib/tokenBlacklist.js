const revoked = new Set();

function add(token) {
  if (token && typeof token === 'string') revoked.add(token);
}

function has(token) {
  return token ? revoked.has(token) : false;
}

module.exports = { add, has };
