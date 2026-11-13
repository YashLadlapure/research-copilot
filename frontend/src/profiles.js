export const PROFILES = [
  { value: 'lncs', label: 'Springer LNCS' },
  { value: 'ieee', label: 'IEEE Conference' },
];

export function profileLabel(value) {
  return PROFILES.find((profile) => profile.value === value)?.label || value;
}
