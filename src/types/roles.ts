export const ROLES = ["admin", "dealer", "restaurant", "corporate", "marketing", "support"] as const;
export type Role = typeof ROLES[number];

export type NavItem = {
  label: string;
  href: string;
  /** Bu menüyü görebilmek için gereken support access ID’leri (1: Kurye, 2: Bayi, ...) */
  requiredAccess?: number[];
};

export type NavGroup = { title: string; items: NavItem[] };

// Type guard
export function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v);
}
