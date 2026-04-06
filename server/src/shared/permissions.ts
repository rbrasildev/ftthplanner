/**
 * Granular Permission System for FTTH Planner
 *
 * Each permission controls access to a specific feature/action.
 * Users can have any combination of permissions assigned individually.
 * Roles define default permission sets, but can be customized per user.
 */

// All available permissions in the system
export const ALL_PERMISSIONS = [
  // Projects
  'projects:create',
  'projects:edit',
  'projects:delete',
  'projects:import',
  'projects:export',

  // Map / Planning (edit elements on the map)
  'map:edit',

  // Map elements — add specific items
  'map:add_cto',
  'map:add_cable',
  'map:add_pole',
  'map:add_pop',
  'map:add_customer',

  // Registrations / Catalogs
  'catalogs:manage',

  // User Management
  'users:manage',

  // Company Settings
  'settings:company',

  // Subscription / Billing
  'subscription:manage',

  // Backup
  'backup:manage',

  // Integrations
  'integrations:manage',

  // Customers
  'customers:manage',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

// Human-readable labels (pt-BR)
export const PERMISSION_LABELS: Record<Permission, string> = {
  'projects:create': 'Criar projetos',
  'projects:edit': 'Editar projetos',
  'projects:delete': 'Excluir projetos',
  'projects:import': 'Importar projetos (KML/KMZ)',
  'projects:export': 'Exportar projetos (KML/KMZ)',
  'map:edit': 'Editar mapa (geral)',
  'map:add_cto': 'Adicionar CTO',
  'map:add_cable': 'Adicionar cabo',
  'map:add_pole': 'Adicionar poste',
  'map:add_pop': 'Adicionar POP',
  'map:add_customer': 'Adicionar cliente no mapa',
  'catalogs:manage': 'Gerenciar cadastros',
  'users:manage': 'Gerenciar usuários',
  'settings:company': 'Configurações da empresa',
  'subscription:manage': 'Gerenciar assinatura',
  'backup:manage': 'Gerenciar backups',
  'integrations:manage': 'Gerenciar integrações',
  'customers:manage': 'Gerenciar clientes',
};

// English labels for i18n
export const PERMISSION_LABELS_EN: Record<Permission, string> = {
  'projects:create': 'Create projects',
  'projects:edit': 'Edit projects',
  'projects:delete': 'Delete projects',
  'projects:import': 'Import projects (KML/KMZ)',
  'projects:export': 'Export projects (KML/KMZ)',
  'map:edit': 'Edit map (general)',
  'map:add_cto': 'Add CTO',
  'map:add_cable': 'Add cable',
  'map:add_pole': 'Add pole',
  'map:add_pop': 'Add POP',
  'map:add_customer': 'Add customer on map',
  'catalogs:manage': 'Manage registrations',
  'users:manage': 'Manage users',
  'settings:company': 'Company settings',
  'subscription:manage': 'Manage subscription',
  'backup:manage': 'Manage backups',
  'integrations:manage': 'Manage integrations',
  'customers:manage': 'Manage customers',
};

// Group permissions for better UI organization
export const PERMISSION_GROUPS: { label: string; labelEn: string; permissions: Permission[] }[] = [
  {
    label: 'Projetos',
    labelEn: 'Projects',
    permissions: ['projects:create', 'projects:edit', 'projects:delete', 'projects:import', 'projects:export'],
  },
  {
    label: 'Planejamento',
    labelEn: 'Planning',
    permissions: ['map:edit', 'map:add_cto', 'map:add_cable', 'map:add_pole', 'map:add_pop', 'map:add_customer'],
  },
  {
    label: 'Cadastros & Clientes',
    labelEn: 'Registrations & Customers',
    permissions: ['catalogs:manage', 'customers:manage'],
  },
  {
    label: 'Administração',
    labelEn: 'Administration',
    permissions: ['users:manage', 'settings:company', 'subscription:manage', 'backup:manage', 'integrations:manage'],
  },
];

// Default permissions per role
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [...ALL_PERMISSIONS],
  ADMIN: [...ALL_PERMISSIONS],
  MEMBER: [
    'projects:create',
    'projects:edit',
    'map:edit',
    'map:add_cto',
    'map:add_cable',
    'map:add_pole',
    'map:add_pop',
    'map:add_customer',
  ],
  SUPER_ADMIN: [...ALL_PERMISSIONS],
};

/**
 * Check if a user has a specific permission.
 * Works with the permissions array stored on the user.
 */
export function hasPermission(userPermissions: string[] | null | undefined, permission: Permission): boolean {
  if (!userPermissions) return false;
  return userPermissions.includes(permission);
}

/**
 * Check if a user has ALL of the specified permissions.
 */
export function hasAllPermissions(userPermissions: string[] | null | undefined, permissions: Permission[]): boolean {
  if (!userPermissions) return false;
  return permissions.every(p => userPermissions.includes(p));
}

/**
 * Check if a user has ANY of the specified permissions.
 */
export function hasAnyPermission(userPermissions: string[] | null | undefined, permissions: Permission[]): boolean {
  if (!userPermissions) return false;
  return permissions.some(p => userPermissions.includes(p));
}
