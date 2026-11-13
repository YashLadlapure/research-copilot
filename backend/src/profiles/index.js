const lncs = require('./lncs');
const ieee = require('./ieee');

const profiles = { lncs, ieee };

function getProfile(key) {
  if (typeof key !== 'string') return null;
  const normalized = key.toLowerCase().trim();
  return Object.hasOwn(profiles, normalized) ? profiles[normalized] : null;
}

module.exports = { getProfile, profileKeys: Object.keys(profiles) };
