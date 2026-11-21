export const PROFILES = [
  { value: 'lncs', label: 'Springer LNCS' },
  { value: 'ieee', label: 'IEEE Conference' },
  { value: 'acm', label: 'ACM Conference' },
  { value: 'acl', label: 'ACL' },
];

export function profileLabel(value) {
  return PROFILES.find((profile) => profile.value === value)?.label || value;
}
