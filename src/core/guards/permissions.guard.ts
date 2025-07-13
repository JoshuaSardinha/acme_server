import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../../modules/role/permissions.service';
import { ServiceBulkPermissionCheckDto } from '../../modules/role/dto/permissions-service.dto';

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';

/**
 * Decorator to specify required permissions for a controller or method.
 * When applied to a class, all methods inherit the class-level permissions.
 * When applied to a method, it overrides or combines with class-level permissions.
 *
 * @param permissions - Array of permission names required (ALL must be present - AND logic)
 *
 * @example
 * ```typescript
 * @Controller('petitions')
 * @RequirePermissions('VIEW_PETITION') // Class-level permission
 * export class PetitionsController {
 *
 *   @Get()
 *   async findAll() {
 *     // Requires VIEW_PETITION (inherited from class)
 *   }
 *
 *   @Post()
 *   @RequirePermissions('CREATE_PETITION') // Method-level permission
 *   async create() {
 *     // Requires both VIEW_PETITION (class) AND CREATE_PETITION (method)
 *   }
 *
 *   @Delete(':id')
 *   @RequirePermissions('DELETE_PETITION', 'MANAGE_PETITIONS') // Multiple permissions
 *   async remove() {
 *     // Requires VIEW_PETITION (class) AND DELETE_PETITION AND MANAGE_PETITIONS (method)
 *   }
 * }
 * ```
 */
export const RequirePermissions = (...permissions: string[]) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    // For method decoration
    if (descriptor) {
      Reflect.defineMetadata(REQUIRE_PERMISSIONS_KEY, permissions, descriptor.value);
      return descriptor;
    }

    // For class decoration
    Reflect.defineMetadata(REQUIRE_PERMISSIONS_KEY, permissions, target);
    return target;
  };
};

/**
 * PermissionsGuard - NestJS guard for protecting routes with permission-based access control
 *
 * Features:
 * - Integrates with PermissionsService for real-time permission checking
 * - Supports both role-based and direct user permissions
 * - Handles multi-tenant company isolation
 * - Combines class-level and method-level permission requirements
 * - Provides detailed error messages for debugging
 * - Optimized for performance with bulk permission checking
 *
 * Usage:
 * ```typescript
 * @Controller('protected')
 * @UseGuards(JwtAuthGuard, PermissionsGuard) // Must come after authentication
 * @RequirePermissions('BASE_ACCESS')
 * export class ProtectedController {
 *
 *   @Get('data')
 *   @RequirePermissions('VIEW_DATA')
 *   async getData() {
 *     // Requires both BASE_ACCESS and VIEW_DATA
 *   }
 * }
 * ```
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const startTime = Date.now();

    // Extract required permissions from metadata (class + method)
    const requiredPermissions = this.getRequiredPermissions(context);

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.debug('No permissions required - allowing access');
      return true;
    }

    // Get user from request context - let ForbiddenException bubble up naturally
    const request = context.switchToHttp().getRequest();
    const user = this.extractAndValidateUser(request);

    // Check if super admin bypass flag is set by SuperAdminBypassGuard
    if (request.superAdminBypass) {
      this.logger.debug(
        `Super admin bypass flag detected for user ${user.id} - bypassing permission checks`
      );
      return true;
    }

    // Remove duplicates from required permissions
    const uniquePermissions = [...new Set(requiredPermissions)];

    this.logger.debug(
      `Checking permissions for user ${user.id}: [${uniquePermissions.join(', ')}]`
    );

    try {
      // Check permissions via service
      const permissionCheck = await this.checkUserPermissions(user, uniquePermissions);

      // Analyze results
      const grantedPermissions = permissionCheck.results
        .filter((result) => result.granted)
        .map((result) => result.permission_name);

      const missingPermissions = permissionCheck.results
        .filter((result) => !result.granted)
        .map((result) => result.permission_name);

      const duration = Date.now() - startTime;

      if (missingPermissions.length > 0) {
        this.logger.warn(
          `Permission check failed for user ${user.id} in ${duration}ms. ` +
            `Required: [${uniquePermissions.join(', ')}], ` +
            `Missing: [${missingPermissions.join(', ')}]`
        );

        this.throwInsufficientPermissionsError(uniquePermissions, missingPermissions);
      }

      this.logger.debug(
        `Permission check passed for user ${user.id} in ${duration}ms. ` +
          `Granted: [${grantedPermissions.join(', ')}]`
      );

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof ForbiddenException) {
        // Re-throw permission-related errors as-is
        throw error;
      }

      // Log and wrap unexpected errors (like service failures)
      this.logger.error(
        `Permission service error after ${duration}ms: ${error.message}`,
        error.stack
      );

      throw new ForbiddenException('Permission check failed');
    }
  }

  /**
   * Extract required permissions from class and method metadata
   */
  private getRequiredPermissions(context: ExecutionContext): string[] {
    const handler = context.getHandler();
    const controllerClass = context.getClass();

    // Get permissions from both class and method
    const classPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [controllerClass]) || [];
    const methodPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [handler]) || [];

    // Combine class and method permissions (both must be satisfied)
    const combinedPermissions = [...classPermissions, ...methodPermissions];

    this.logger.debug(
      `Permission metadata - Class: [${classPermissions.join(', ')}], ` +
        `Method: [${methodPermissions.join(', ')}], ` +
        `Combined: [${combinedPermissions.join(', ')}]`
    );

    return combinedPermissions;
  }

  /**
   * Extract and validate user from request
   */
  private extractAndValidateUser(request: any): any {
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Validate required user properties
    if (!user.id || typeof user.id !== 'string') {
      throw new ForbiddenException('Invalid user context');
    }

    return user;
  }

  /**
   * Check user permissions via PermissionsService
   */
  private async checkUserPermissions(user: any, permissions: string[]) {
    const checkDto: ServiceBulkPermissionCheckDto = {
      user_id: user.id,
      permission_names: permissions,
      company_id: user.company_id,
    };

    try {
      const result = await this.permissionsService.hasPermissions(checkDto);

      // Validate service response
      if (!result || !Array.isArray(result.results)) {
        throw new Error('Invalid permission service response');
      }

      return result;
    } catch (error) {
      this.logger.error(
        `PermissionsService error for user ${user.id}: ${error.message}`,
        error.stack
      );
      throw new Error(`Permission service failure: ${error.message}`);
    }
  }

  /**
   * Throw detailed insufficient permissions error
   */
  private throwInsufficientPermissionsError(required: string[], missing: string[]): never {
    let message = `Insufficient permissions. Required: ${required.join(', ')}`;

    if (missing.length > 0) {
      message += `. Missing: ${missing.join(', ')}`;
    }

    throw new ForbiddenException(message);
  }
}
