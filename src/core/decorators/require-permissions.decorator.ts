import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for storing required permissions in route handlers
 */
export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';

/**
 * Decorator to specify required permissions for accessing a route or controller
 *
 * This decorator can be applied at both the method and class level:
 * - Method level: Protects individual route handlers
 * - Class level: Protects all routes in the controller
 *
 * The decorator stores permission metadata that can be extracted by guards
 * using the Reflector service to enforce permission-based access control.
 *
 * @param permissions - Array of permission names that the user must have
 *
 * @example
 * ```typescript
 * // Method level usage
 * @RequirePermissions('users.read', 'users.write')
 * @Get()
 * async getUsers() {
 *   // Only users with both 'users.read' AND 'users.write' permissions can access
 * }
 *
 * // Class level usage
 * @RequirePermissions('admin.access')
 * @Controller('admin')
 * export class AdminController {
 *   // All routes in this controller require 'admin.access' permission
 * }
 *
 * // Single permission
 * @RequirePermissions('teams.create')
 * @Post('teams')
 * async createTeam() {
 *   // Only users with 'teams.create' permission can access
 * }
 * ```
 *
 * @remarks
 * - Multiple permissions are combined with AND logic (user must have ALL permissions)
 * - Permissions are validated against the user's effective permissions from the PermissionsService
 * - The decorator works in conjunction with permission guards that implement the actual authorization logic
 * - Permission names should follow the format: 'resource.action' (e.g., 'users.read', 'teams.delete')
 *
 * @see PermissionsService.getEffectivePermissionsForUser() for permission resolution
 * @see REQUIRE_PERMISSIONS_KEY for the metadata key used by guards
 */
export const RequirePermissions = (...permissions: string[]) => {
  return SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
};
