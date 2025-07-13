/**
 * Centralized error codes for consistent error handling across the application.
 * These constants replace magic strings and ensure consistent error codes.
 */
export const ERROR_CODES = {
  // Authentication & Authorization errors
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',

  // Company errors
  COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
  COMPANY_ACCESS_DENIED: 'COMPANY_ACCESS_DENIED',

  // Team errors
  TEAM_NOT_FOUND: 'TEAM_NOT_FOUND',
  TEAM_ACCESS_DENIED: 'TEAM_ACCESS_DENIED',

  // User errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ACCESS_DENIED: 'USER_ACCESS_DENIED',
} as const;

/**
 * Type for error codes to ensure type safety
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
