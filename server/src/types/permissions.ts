import { UserRole } from './enums';

export const USER_MANAGEMENT_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

export const RESOURCE_MANAGEMENT_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

export function canManageUsers(role?: UserRole | null): boolean {
  return role != null && USER_MANAGEMENT_ROLES.includes(role);
}

export function canManageResources(role?: UserRole | null): boolean {
  return role != null && RESOURCE_MANAGEMENT_ROLES.includes(role);
}
