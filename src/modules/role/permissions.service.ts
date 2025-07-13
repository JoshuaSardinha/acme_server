import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { User, UserRole } from '../auth/entities/user.entity';
import {
  CacheInvalidationResponseDto,
  CacheStatisticsDto,
  CacheWarmupDto,
  CacheWarmupResponseDto,
  InvalidateCacheDto,
} from './dto/permission-cache.dto';
import {
  PermissionSourceType,
  PermissionsServiceConfigDto,
  ServiceBulkPermissionCheckDto,
  ServiceBulkPermissionCheckResultDto,
  ServiceEffectivePermissionDto,
  ServicePermissionCheckDto,
  ServicePermissionCheckResultDto,
  UserEffectivePermissionsDto,
} from './dto/permissions-service.dto';
import { Permission, Role, RolePermission, UserPermission } from './entities';

// Simple cache entry interface
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  hitCount: number;
  createdAt: number;
}

/**
 * PermissionsService - Core service for user permission management with caching
 *
 * Handles:
 * - User permission calculation (role-based + direct permissions)
 * - Permission caching with TTL and invalidation
 * - Multi-tenant company-based isolation
 * - Permission precedence (direct permissions override role permissions)
 * - Cache management and statistics
 */
@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);
  private readonly config: PermissionsServiceConfigDto;
  private readonly cache = new Map<string, CacheEntry<any>>();

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
    @InjectModel(Permission)
    private readonly permissionModel: typeof Permission,
    @InjectModel(UserPermission)
    private readonly userPermissionModel: typeof UserPermission,
    @InjectModel(RolePermission)
    private readonly rolePermissionModel: typeof RolePermission,
    private readonly configService: ConfigService
  ) {
    // Initialize service configuration
    this.config = {
      cache_ttl_seconds: this.configService.get<number>('PERMISSIONS_CACHE_TTL', 3600), // 1 hour default
      max_cache_entries: this.configService.get<number>('PERMISSIONS_MAX_CACHE_ENTRIES', 10000),
      cache_enabled: this.configService.get<boolean>('PERMISSIONS_CACHE_ENABLED', true),
      background_refresh_interval: this.configService.get<number>(
        'PERMISSIONS_BACKGROUND_REFRESH',
        1800
      ), // 30 min
      include_system_permissions: this.configService.get<boolean>(
        'PERMISSIONS_INCLUDE_SYSTEM',
        true
      ),
    };

    this.logger.log(`PermissionsService initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * Check if a user is a super admin
   * Super admins can be identified by having the 'Super Admin' role
   */
  async isSuperAdmin(userId: string, companyId?: string): Promise<boolean> {
    try {
      const user = await this.userModel.findByPk(userId, {
        attributes: ['id', 'role_id', 'company_id'],
        include: [
          {
            model: Role,
            attributes: ['id', 'name', 'code'],
            required: true,
          },
        ],
      });

      if (!user || !user.role) {
        return false;
      }

      // Check if user has Super Admin role by name or code
      return user.role.name === 'Super Admin' || user.role.code === 'super_admin';
    } catch (error) {
      this.logger.error(`Error checking super admin status for user ${userId}:`, error);
      return false; // Default to false on error
    }
  }

  /**
   * Main method: Get all effective permissions for a user
   * Combines role-based permissions and direct user permissions
   * Super admins receive all possible permissions automatically
   */
  async getEffectivePermissionsForUser(
    userId: string,
    companyId?: string,
    forceRefresh: boolean = false
  ): Promise<UserEffectivePermissionsDto> {
    const startTime = Date.now();
    this.logger.debug(`Getting effective permissions for user ${userId}, company ${companyId}`);

    try {
      // Check cache first (unless force refresh)
      const cacheKey = this.generateCacheKey('user_permissions', userId, companyId);
      let cachedResult: UserEffectivePermissionsDto | null = null;

      if (this.config.cache_enabled && !forceRefresh) {
        cachedResult = this.getCachedValue<UserEffectivePermissionsDto>(cacheKey);
        if (cachedResult) {
          this.logger.debug(`Cache hit for user permissions: ${userId}`);
          return {
            ...cachedResult,
            from_cache: true,
          };
        }
      }

      // Fetch user with company validation
      const user = await this.validateUserAndCompany(userId, companyId);
      const effectiveCompanyId = companyId || user.company_id;

      // Check if user is a super admin first
      const isSuperAdmin = await this.isSuperAdmin(userId, effectiveCompanyId);

      let effectivePermissions: ServiceEffectivePermissionDto[];

      if (isSuperAdmin) {
        // Super admins get all permissions
        this.logger.debug(`User ${userId} is super admin - granting all permissions`);
        effectivePermissions = await this.getAllPermissionsForSuperAdmin();
      } else {
        // Calculate permissions from database for regular users
        const [rolePermissions, directPermissions] = await Promise.all([
          this.getRoleBasedPermissions(userId, effectiveCompanyId),
          this.getDirectUserPermissions(userId),
        ]);

        // Merge and deduplicate permissions (direct permissions take precedence)
        effectivePermissions = this.mergePermissions(rolePermissions, directPermissions);
      }

      // Build response DTO
      const result: UserEffectivePermissionsDto = {
        user_id: userId,
        company_id: effectiveCompanyId,
        permissions: effectivePermissions,
        permission_names: effectivePermissions.map((p) => p.name),
        calculated_at: new Date(),
        from_cache: false,
        cache_ttl_seconds: this.config.cache_ttl_seconds,
      };

      // Cache the result
      if (this.config.cache_enabled) {
        this.setCachedValue(cacheKey, result, this.config.cache_ttl_seconds);
        this.logger.debug(`Cached user permissions for ${userId}`);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Calculated permissions for user ${userId} in ${duration}ms`);

      return result;
    } catch (error) {
      this.logger.error(`Error getting effective permissions for user ${userId}:`, error);
      throw new InternalServerErrorException(
        `Failed to retrieve user permissions: ${error.message}`
      );
    }
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    checkDto: ServicePermissionCheckDto
  ): Promise<ServicePermissionCheckResultDto> {
    const startTime = Date.now();
    this.logger.debug(
      `Checking permission ${checkDto.permission_name} for user ${checkDto.user_id}`
    );

    try {
      // Get user's effective permissions
      const userPermissions = await this.getEffectivePermissionsForUser(
        checkDto.user_id,
        checkDto.company_id,
        checkDto.force_refresh
      );

      // Find the specific permission
      const permission = userPermissions.permissions.find(
        (p) => p.name === checkDto.permission_name && p.is_active
      );

      const result: ServicePermissionCheckResultDto = {
        granted: !!permission,
        permission_name: checkDto.permission_name,
        user_id: checkDto.user_id,
        source: permission?.source,
        source_role_name: permission?.source_role_name,
        checked_at: new Date(),
        from_cache: userPermissions.from_cache,
      };

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Permission check ${checkDto.permission_name} for user ${checkDto.user_id}: ${result.granted} (${duration}ms)`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error checking permission ${checkDto.permission_name} for user ${checkDto.user_id}:`,
        error
      );
      throw new InternalServerErrorException(`Failed to check user permission: ${error.message}`);
    }
  }

  /**
   * Check multiple permissions at once for better performance
   */
  async hasPermissions(
    checkDto: ServiceBulkPermissionCheckDto
  ): Promise<ServiceBulkPermissionCheckResultDto> {
    const startTime = Date.now();
    this.logger.debug(
      `Bulk checking ${checkDto.permission_names.length} permissions for user ${checkDto.user_id}`
    );

    try {
      // Get user's effective permissions once
      const userPermissions = await this.getEffectivePermissionsForUser(
        checkDto.user_id,
        checkDto.company_id,
        checkDto.force_refresh
      );

      // Check each permission
      const results: ServicePermissionCheckResultDto[] = checkDto.permission_names.map(
        (permissionName) => {
          const permission = userPermissions.permissions.find(
            (p) => p.name === permissionName && p.is_active
          );

          return {
            granted: !!permission,
            permission_name: permissionName,
            user_id: checkDto.user_id,
            source: permission?.source,
            source_role_name: permission?.source_role_name,
            checked_at: new Date(),
            from_cache: userPermissions.from_cache,
          };
        }
      );

      const grantedCount = results.filter((r) => r.granted).length;

      const result: ServiceBulkPermissionCheckResultDto = {
        user_id: checkDto.user_id,
        results,
        total_checked: results.length,
        granted_count: grantedCount,
        checked_at: new Date(),
        from_cache: userPermissions.from_cache,
      };

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Bulk permission check for user ${checkDto.user_id}: ${grantedCount}/${results.length} granted (${duration}ms)`
      );

      return result;
    } catch (error) {
      this.logger.error(`Error in bulk permission check for user ${checkDto.user_id}:`, error);
      throw new InternalServerErrorException(`Failed to check user permissions: ${error.message}`);
    }
  }

  /**
   * Get permissions for a user with proper authorization checks
   * This is the new method that handles multi-tenant security properly
   */
  async getPermissionsForUser(
    targetUserId: string,
    requestingUser: User,
    forceRefresh: boolean = false
  ): Promise<UserEffectivePermissionsDto> {
    try {
      // Validate access using proper authorization logic
      const targetUser = await this.validateAccess(targetUserId, requestingUser);

      // If validation passes, get the permissions
      return await this.getEffectivePermissionsForUser(
        targetUserId,
        targetUser.company_id,
        forceRefresh
      );
    } catch (error) {
      this.logger.error(`Error getting permissions for user ${targetUserId}:`, error);

      // Re-throw known exceptions as-is
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to retrieve user permissions: ${error.message}`
      );
    }
  }

  /**
   * Check a single permission for a user with proper authorization
   */
  async checkPermissionForUser(
    targetUserId: string,
    requestingUser: User,
    permissionName: string,
    companyId?: string
  ): Promise<ServicePermissionCheckResultDto> {
    try {
      // Validate access first
      const targetUser = await this.validateAccess(targetUserId, requestingUser);

      // Use the company from the target user
      const effectiveCompanyId = companyId || targetUser.company_id;

      const serviceDto: ServicePermissionCheckDto = {
        user_id: targetUserId,
        permission_name: permissionName,
        company_id: effectiveCompanyId,
        force_refresh: false,
      };

      return await this.hasPermission(serviceDto);
    } catch (error) {
      this.logger.error(
        `Error checking permission ${permissionName} for user ${targetUserId}:`,
        error
      );

      // Re-throw known exceptions as-is
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException(`Failed to check user permission: ${error.message}`);
    }
  }

  /**
   * Check multiple permissions for a user with proper authorization
   */
  async checkPermissionsForUser(
    targetUserId: string,
    requestingUser: User,
    permissionNames: string[],
    companyId?: string
  ): Promise<ServiceBulkPermissionCheckResultDto> {
    try {
      // Validate access first
      const targetUser = await this.validateAccess(targetUserId, requestingUser);

      // Use the company from the target user
      const effectiveCompanyId = companyId || targetUser.company_id;

      const serviceDto: ServiceBulkPermissionCheckDto = {
        user_id: targetUserId,
        permission_names: permissionNames,
        company_id: effectiveCompanyId,
        force_refresh: false,
      };

      return await this.hasPermissions(serviceDto);
    } catch (error) {
      this.logger.error(`Error bulk checking permissions for user ${targetUserId}:`, error);

      // Re-throw known exceptions as-is
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException(`Failed to check user permissions: ${error.message}`);
    }
  }

  /**
   * Invalidate permission cache for users
   */
  async invalidateCache(invalidateDto: InvalidateCacheDto): Promise<CacheInvalidationResponseDto> {
    const startTime = Date.now();
    this.logger.debug(`Invalidating cache with criteria: ${JSON.stringify(invalidateDto)}`);

    try {
      const keysToInvalidate: string[] = [];

      if (invalidateDto.invalidate_all) {
        // Clear all permission caches - this is expensive but thorough
        const totalKeys = this.cache.size;
        this.cache.clear();
        return {
          invalidated_count: totalKeys,
          invalidated_keys: ['*'],
          invalidated_at: new Date(),
          reason: invalidateDto.reason || 'Full cache invalidation requested',
        };
      }

      // Build specific cache keys to invalidate
      if (invalidateDto.user_id) {
        keysToInvalidate.push(
          this.generateCacheKey('user_permissions', invalidateDto.user_id),
          this.generateCacheKey('user_permissions', invalidateDto.user_id, invalidateDto.company_id)
        );
      }

      if (invalidateDto.company_id) {
        // For company-wide invalidation, we need to find all users in the company
        const companyUsers = await this.userModel.findAll({
          where: { company_id: invalidateDto.company_id },
          attributes: ['id'],
        });

        // Ensure companyUsers is always an array
        const users = Array.isArray(companyUsers) ? companyUsers : [];
        for (const user of users) {
          keysToInvalidate.push(
            this.generateCacheKey('user_permissions', user.id),
            this.generateCacheKey('user_permissions', user.id, invalidateDto.company_id)
          );
        }
      }

      if (invalidateDto.role_id) {
        // Find all users with this role and invalidate their caches
        const roleUsers = await this.userModel.findAll({
          where: { role_id: invalidateDto.role_id },
          attributes: ['id', 'company_id'],
        });

        // Ensure roleUsers is always an array
        const users = Array.isArray(roleUsers) ? roleUsers : [];
        for (const user of users) {
          keysToInvalidate.push(
            this.generateCacheKey('user_permissions', user.id),
            this.generateCacheKey('user_permissions', user.id, user.company_id)
          );
        }
      }

      // Remove duplicates
      const uniqueKeys = [...new Set(keysToInvalidate)];

      // Invalidate each key
      uniqueKeys.forEach((key) => this.cache.delete(key));

      const duration = Date.now() - startTime;
      this.logger.log(
        `Cache invalidation completed: ${uniqueKeys.length} keys invalidated in ${duration}ms. Reason: ${invalidateDto.reason || 'Not specified'}`
      );

      return {
        invalidated_count: uniqueKeys.length,
        invalidated_keys: uniqueKeys,
        invalidated_at: new Date(),
        reason: invalidateDto.reason,
      };
    } catch (error) {
      this.logger.error('Error invalidating permission cache:', error);
      throw new InternalServerErrorException(
        `Failed to invalidate permission cache: ${error.message}`
      );
    }
  }

  /**
   * Warm up cache for specific users or company
   */
  async warmupCache(warmupDto: CacheWarmupDto): Promise<CacheWarmupResponseDto> {
    const startTime = Date.now();
    this.logger.debug(`Warming up cache with criteria: ${JSON.stringify(warmupDto)}`);

    try {
      let usersToWarmup: User[] = [];
      const errors: string[] = [];

      if (warmupDto.user_ids?.length) {
        const foundUsers = await this.userModel.findAll({
          where: { id: warmupDto.user_ids },
          attributes: ['id', 'company_id'],
        });
        usersToWarmup = Array.isArray(foundUsers) ? foundUsers : [];

        // Check for non-existent users and add them to errors
        const foundUserIds = usersToWarmup.map((u) => u.id);
        const missingUserIds = warmupDto.user_ids.filter((id) => !foundUserIds.includes(id));

        for (const missingId of missingUserIds) {
          errors.push(`User not found: ${missingId}`);
        }
      } else if (warmupDto.company_id) {
        const companyUsers = await this.userModel.findAll({
          where: { company_id: warmupDto.company_id },
          attributes: ['id', 'company_id'],
        });
        usersToWarmup = Array.isArray(companyUsers) ? companyUsers : [];
      } else if (warmupDto.role_id) {
        const roleUsers = await this.userModel.findAll({
          where: { role_id: warmupDto.role_id },
          attributes: ['id', 'company_id'],
        });
        usersToWarmup = Array.isArray(roleUsers) ? roleUsers : [];
      } else if (warmupDto.warmup_all) {
        const allUsers = await this.userModel.findAll({
          attributes: ['id', 'company_id'],
          limit: 1000, // Safety limit for warmup_all
        });
        usersToWarmup = Array.isArray(allUsers) ? allUsers : [];
      }

      let warmedCount = 0;

      // Warm up permissions for each user
      const warmupPromises = usersToWarmup.map(async (user) => {
        try {
          await this.getEffectivePermissionsForUser(user.id, user.company_id, true);
          warmedCount++;
        } catch (error) {
          const errorMsg = `Failed to warm up cache for user ${user.id}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.warn(errorMsg);
        }
      });

      await Promise.all(warmupPromises);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Cache warmup completed: ${warmedCount}/${usersToWarmup.length} users processed in ${duration}ms`
      );

      return {
        warmed_count: warmedCount,
        users_processed: usersToWarmup.length,
        duration_ms: duration,
        completed_at: new Date(),
        errors,
      };
    } catch (error) {
      this.logger.error('Error warming up permission cache:', error);
      throw new InternalServerErrorException(
        `Failed to warm up permission cache: ${error.message}`
      );
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStatistics(): Promise<CacheStatisticsDto> {
    try {
      // Clean expired entries first
      this.cleanupExpiredCache();

      let totalHits = 0;
      let activeEntries = 0;
      const now = Date.now();

      for (const [key, entry] of this.cache.entries()) {
        totalHits += entry.hitCount;
        if (now <= entry.expiresAt) {
          activeEntries++;
        }
      }

      const totalEntries = this.cache.size;

      return {
        total_entries: totalEntries,
        active_entries: activeEntries,
        expired_entries: 0, // Cleaned up above
        total_hits: totalHits,
        total_misses: 0, // Would need separate tracking
        hit_ratio: totalHits > 0 ? totalHits / (totalHits + 1) : 0, // Approximation
        memory_usage_bytes: this.estimateCacheMemoryUsage(),
        average_entry_size: totalEntries > 0 ? this.estimateCacheMemoryUsage() / totalEntries : 0,
        calculated_at: new Date(),
      };
    } catch (error) {
      this.logger.error('Error getting cache statistics:', error);
      throw new InternalServerErrorException(`Failed to get cache statistics: ${error.message}`);
    }
  }

  // Private helper methods

  /**
   * Get all permissions for super admin users
   */
  private async getAllPermissionsForSuperAdmin(): Promise<ServiceEffectivePermissionDto[]> {
    try {
      const allPermissions = await this.permissionModel.findAll({
        attributes: ['name', 'category'],
      });

      return allPermissions.map((permission) => ({
        name: permission.name,
        category: permission.category,
        source: PermissionSourceType.ROLE,
        source_role_name: 'Super Admin',
        is_active: true,
      }));
    } catch (error) {
      this.logger.error('Error fetching all permissions for super admin:', error);
      return [];
    }
  }

  /**
   * Sanitize error messages to prevent information disclosure
   */
  private sanitizeErrorMessage(error: any): string {
    if (!error) return 'An unexpected error occurred';

    const message = error.message || error.toString();

    // Remove sensitive information from error messages
    const sensitivePatterns = [
      /mysql:\/\/[^@]*@[^\/]*/gi, // Database connection strings
      /password[=:]\s*[^\s;,)]*/gi, // Password values
      /key[=:]\s*[^\s;,)]*/gi, // API keys
      /token[=:]\s*[^\s;,)]*/gi, // Tokens
      /localhost/gi, // Server hostnames
      /127\.0\.0\.1/gi, // Local IP addresses
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gi, // IP addresses
    ];

    let sanitizedMessage = message;
    for (const pattern of sensitivePatterns) {
      sanitizedMessage = sanitizedMessage.replace(pattern, '[REDACTED]');
    }

    return sanitizedMessage;
  }

  /**
   * Validates if the requesting user has access to the target user's data.
   * Throws NotFoundException if the target user doesn't exist.
   * Throws ForbiddenException if the requesting user is not authorized.
   * Returns the target user object on success.
   */
  private async validateAccess(targetUserId: string, requestingUser: User): Promise<User> {
    try {
      // 1. Check if the target resource exists. If not, it's a 404.
      const targetUser = await this.userModel.findByPk(targetUserId, {
        attributes: ['id', 'company_id', 'email'],
      });

      if (!targetUser) {
        throw new NotFoundException({
          success: false,
          code: 'USER_NOT_FOUND',
          message: `User not found: ${targetUserId}`,
        });
      }

      // 2. Define access rules (the core business logic)
      const isSameUser = requestingUser.id === targetUser.id;
      const isSameCompany = requestingUser.company_id === targetUser.company_id;

      // Check role-based access using the new role structure
      const isAcmeAdmin = requestingUser.hasRoleEnum(UserRole.ACME_ADMIN);
      const isSuperAdmin = requestingUser.hasRoleEnum(UserRole.SUPER_ADMIN);
      const isRequestingUserAdmin =
        requestingUser.hasRoleEnum(UserRole.VENDOR_ADMIN) ||
        requestingUser.hasRoleEnum(UserRole.ACME_ADMIN);

      // 3. Grant access if:
      //    a) The user is accessing their own permissions.
      //    b) The user is an admin accessing someone within their own company.
      //    c) The user is an Acme admin (can access any company).
      //    d) The user is a Super Admin (can access anyone).
      if (isSameUser || (isRequestingUserAdmin && isSameCompany) || isAcmeAdmin || isSuperAdmin) {
        return targetUser; // Access granted
      }

      // 4. If none of the above rules match, deny access.
      // This correctly handles the cross-tenant case, resulting in a 403.
      throw new ForbiddenException({
        success: false,
        code: 'FORBIDDEN_ACCESS',
        message: 'You are not authorized to access this resource.',
      });
    } catch (error) {
      // Re-throw known exceptions as-is
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      // Sanitize and wrap unexpected errors
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      this.logger.error(`Database error in validateAccess: ${error.message}`);
      throw new InternalServerErrorException(`Failed to validate user access: ${sanitizedMessage}`);
    }
  }

  private async validateUserAndCompany(userId: string, companyId?: string): Promise<User> {
    try {
      const user = await this.userModel.findByPk(userId, {
        attributes: ['id', 'company_id', 'email'],
      });

      if (!user) {
        throw new NotFoundException({
          success: false,
          code: 'USER_NOT_FOUND',
          message: `User not found: ${userId}`,
        });
      }

      if (companyId && user.company_id !== companyId) {
        throw new BadRequestException({
          success: false,
          code: 'USER_COMPANY_MISMATCH',
          message: `User ${userId} does not belong to company ${companyId}`,
        });
      }

      return user;
    } catch (error) {
      // Re-throw known exceptions as-is
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // Sanitize and wrap unexpected errors
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      this.logger.error(`Database error in validateUserAndCompany: ${error.message}`);
      throw new InternalServerErrorException(`Failed to validate user: ${sanitizedMessage}`);
    }
  }

  private async getRoleBasedPermissions(
    userId: string,
    companyId: string
  ): Promise<ServiceEffectivePermissionDto[]> {
    // Get the user with their role and role permissions
    const user = await this.userModel.findByPk(userId, {
      attributes: ['id', 'role_id'],
      include: [
        {
          model: Role,
          attributes: ['id', 'name', 'code'],
          include: [
            {
              model: Permission,
              as: 'permissions',
              through: {
                attributes: [],
                where: {}, // Ensure proper junction table handling
              },
              required: false,
              attributes: ['id', 'name', 'category'], // Only fetch needed fields
            },
          ],
        },
      ],
    });

    const rolePermissions: ServiceEffectivePermissionDto[] = [];

    if (user?.role?.permissions) {
      // All roles are now system roles, so include all role permissions
      if (true) {
        for (const permission of user.role.permissions) {
          rolePermissions.push({
            name: permission.name,
            category: permission.category,
            source: PermissionSourceType.ROLE,
            source_role_id: user.role.id,
            source_role_name: user.role.name,
            is_active: true,
          });
        }
      }
    }

    return rolePermissions;
  }

  private async getDirectUserPermissions(userId: string): Promise<ServiceEffectivePermissionDto[]> {
    const userPermissions = await this.userPermissionModel.findAll({
      where: {
        user_id: userId,
        granted: true,
      },
      include: [
        {
          model: Permission,
          attributes: ['name', 'category'],
          required: true, // Inner join for better performance
        },
      ],
      attributes: ['user_id', 'permission_id', 'granted_at'], // Limit fields
    });

    return userPermissions.map((up) => ({
      name: up.permission.name,
      category: up.permission.category,
      source: PermissionSourceType.DIRECT,
      expires_at: up.granted_at
        ? new Date(up.granted_at.getTime() + 365 * 24 * 60 * 60 * 1000)
        : undefined, // 1 year default
      is_active: true,
    }));
  }

  private mergePermissions(
    rolePermissions: ServiceEffectivePermissionDto[],
    directPermissions: ServiceEffectivePermissionDto[]
  ): ServiceEffectivePermissionDto[] {
    const permissionMap = new Map<string, ServiceEffectivePermissionDto>();

    // Add role permissions first
    for (const permission of rolePermissions) {
      permissionMap.set(permission.name, permission);
    }

    // Direct permissions override role permissions
    for (const permission of directPermissions) {
      permissionMap.set(permission.name, permission);
    }

    return Array.from(permissionMap.values()).sort(
      (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  }

  private generateCacheKey(type: string, userId: string, companyId?: string): string {
    const base = `permissions:${type}:${userId}`;
    return companyId ? `${base}:${companyId}` : base;
  }

  /**
   * Get service configuration
   */
  getConfig(): PermissionsServiceConfigDto {
    return { ...this.config };
  }

  // Cache management helper methods

  private getCachedValue<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access stats
    entry.hitCount++;
    return entry.data as T;
  }

  private setCachedValue<T>(key: string, value: T, ttlSeconds: number): void {
    // Implement basic cache size limit
    if (this.cache.size >= this.config.max_cache_entries) {
      // Remove oldest entries (simple LRU approximation)
      const keysToRemove = Array.from(this.cache.keys()).slice(
        0,
        Math.floor(this.config.max_cache_entries * 0.1)
      );
      keysToRemove.forEach((k) => this.cache.delete(k));
    }

    const entry: CacheEntry<T> = {
      data: value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      hitCount: 0,
      createdAt: Date.now(),
    };

    this.cache.set(key, entry);
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private estimateCacheMemoryUsage(): number {
    // Rough estimation of memory usage
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      // Estimate key size (string)
      totalSize += key.length * 2; // UTF-16 characters

      // Estimate entry overhead and data size
      totalSize += 64; // Rough estimate of entry object overhead
      totalSize += JSON.stringify(entry.data).length * 2; // Data size estimation
    }
    return totalSize;
  }
}
