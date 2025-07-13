import { UserRole } from '../entities/user.entity';

export const ACME_ROLES = [
  UserRole.ACME_EMPLOYEE,
  UserRole.ACME_MANAGER,
  UserRole.ACME_ADMIN,
] as const;

export type AcmeRole = (typeof ACME_ROLES)[number];
