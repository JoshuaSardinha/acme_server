/**
 * Constants for the Acme company.
 * This company must always exist in the database and has special properties.
 */
export const ACME_COMPANY = {
  // Fixed UUID for the Acme company - NEVER change this value
  ID: '00000000-0000-0000-0000-000000000001',
  NAME: 'Acme',
  TYPE: 'ACME' as const,
  STATUS: 'ACTIVE' as const,
  EMAIL: 'team@acme.com',
  ADDRESS: '123 Main Street, Suite 100, Anytown CA 12345',
  PHONE: '+1 (555) 123-4567',
  SUBDOMAIN: 'acme',
  SUBSCRIPTION_TYPE: 'ENTERPRISE',
  SUBSCRIPTION_STATUS: 'ACTIVE',
} as const;

/**
 * Error messages related to Acme company protection
 */
export const ACME_ERRORS = {
  CANNOT_DELETE: 'Cannot delete the Acme company',
  CANNOT_CHANGE_TYPE: 'Cannot change the type of the Acme company',
  CANNOT_SUSPEND: 'Cannot suspend the Acme company',
  ONLY_ACME_TYPE: 'Only the Acme company can have ACME type',
  DUPLICATE_ACME: 'There can only be one company with ACME type',
} as const;
