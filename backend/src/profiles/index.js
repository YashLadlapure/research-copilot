const lncsProfile = require('./lncs');
const ieeeProfile = require('./ieee');

const profileMap = {
  lncs: lncsProfile,
  ieee: ieeeProfile,
};

function getProfileConfig(profile) {
  const key = profile.toLowerCase().trim();
  if (!profileMap[key]) {
    throw new Error(`Unsupported profile: "${profile}". Supported profiles are: lncs, ieee.`);
  }
  return profileMap[key];
}

module.exports = { getProfileConfig };
