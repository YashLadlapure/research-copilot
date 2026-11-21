const lncs = require('./lncs');
const ieee = require('./ieee');
const acm = require('./acm');
const acl = require('./acl');

const profiles = { lncs, ieee, acm, acl };

function getProfile(key) {
  if (typeof key !== 'string') return null;
  const normalized = key.toLowerCase().trim();
  return Object.hasOwn(profiles, normalized) ? profiles[normalized] : null;
}

module.exports = { getProfile, profileKeys: Object.keys(profiles) };
