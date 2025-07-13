import { SetMetadata } from '@nestjs/common';

export const TEAM_VALIDATION_KEY = 'team_validation';

/**
 * Decorator to mark endpoints that should use team validation error format
 * These endpoints will return the Express team validation format:
 * { success: false, code: "TEAM_VALIDATION_ERROR", message: "Invalid company data provided", errors: [...] }
 */
export const UseTeamValidation = () => SetMetadata(TEAM_VALIDATION_KEY, true);
