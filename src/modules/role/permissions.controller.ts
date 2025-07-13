import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsService } from './permissions.service';

// Import DTOs
import {
  AssignPermissionsDto,
  AssignRoleToUserDto,
  CacheInvalidationResponseDto,
  CacheStatisticsDto,
  CacheWarmupDto,
  CacheWarmupResponseDto,
  CheckUserPermissionDto,
  CreatePermissionDto,
  CreateRoleDto,
  GrantUserPermissionDto,
  // Cache DTOs
  InvalidateCacheDto,
  PermissionCheckResponseDto,
  // Permission DTOs
  PermissionDto,
  PermissionListResponseDto,
  PermissionQueryDto,
  RoleListResponseDto,
  RoleQueryDto,
  // Role DTOs
  RoleWithPermissionsDto,
  UpdatePermissionDto,
  // User Permission DTOs
  UserPermissionsResponseDto,
} from './dto';

// Import service DTOs for permission checks

// Import entities for responses
import { User } from '../auth/entities/user.entity';
import { Role } from './entities/role.entity';

/**
 * PermissionsController - HTTP API for the permission system
 *
 * Provides endpoints for:
 * - Permission CRUD operations
 * - Role management with permission assignments
 * - User permission management (direct + role-based)
 * - Permission checking and validation
 * - Cache management for performance
 *
 * All endpoints are protected with JWT authentication.
 * TODO: Add PermissionsGuard when available for granular access control.
 */
@ApiTags('permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // ========================================
  // PERMISSION MANAGEMENT ENDPOINTS
  // ========================================

  @Get()
  @ApiOperation({
    summary: 'List all permissions',
    description: 'Retrieve all permissions with optional filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
    type: PermissionListResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPermissions(@Query() query: PermissionQueryDto): Promise<PermissionListResponseDto> {
    try {
      // TODO: Implement permission listing in PermissionsService
      // For now, return mock response
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_NOT_IMPLEMENTED',
        message: 'Permission listing not yet implemented',
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_LIST_ERROR',
        message: 'Failed to retrieve permissions',
      });
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create new permission',
    description: 'Create a new permission in the system',
  })
  @ApiResponse({
    status: 201,
    description: 'Permission created successfully',
    type: PermissionDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid permission data' })
  @ApiResponse({ status: 409, description: 'Permission already exists' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @HttpCode(HttpStatus.CREATED)
  async createPermission(@Body() createPermissionDto: CreatePermissionDto): Promise<PermissionDto> {
    try {
      // TODO: Implement permission creation in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_CREATE_NOT_IMPLEMENTED',
        message: 'Permission creation not yet implemented',
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_CREATE_ERROR',
        message: 'Failed to create permission',
      });
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get specific permission',
    description: 'Retrieve a permission by its ID',
  })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission retrieved successfully',
    type: PermissionDto,
  })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPermission(@Param('id') id: string): Promise<PermissionDto> {
    try {
      // TODO: Implement get permission by ID in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_GET_NOT_IMPLEMENTED',
        message: 'Get permission not yet implemented',
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_GET_ERROR',
        message: 'Failed to retrieve permission',
      });
    }
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update permission',
    description: 'Update an existing permission',
  })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission updated successfully',
    type: PermissionDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid permission data' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updatePermission(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto
  ): Promise<PermissionDto> {
    try {
      // TODO: Implement permission update in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_UPDATE_NOT_IMPLEMENTED',
        message: 'Permission update not yet implemented',
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_UPDATE_ERROR',
        message: 'Failed to update permission',
      });
    }
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete permission',
    description: 'Delete a permission from the system',
  })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({ status: 204, description: 'Permission deleted successfully' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 409, description: 'Permission is in use and cannot be deleted' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePermission(@Param('id') id: string): Promise<void> {
    try {
      // TODO: Implement permission deletion in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_DELETE_NOT_IMPLEMENTED',
        message: 'Permission deletion not yet implemented',
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'PERMISSIONS_DELETE_ERROR',
        message: 'Failed to delete permission',
      });
    }
  }

  // ========================================
  // ROLE MANAGEMENT ENDPOINTS
  // ========================================

  @Get('roles')
  @ApiOperation({
    summary: 'List roles',
    description: 'Retrieve roles with optional filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Roles retrieved successfully',
    type: RoleListResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getRoles(@Query() query: RoleQueryDto): Promise<RoleListResponseDto> {
    try {
      // TODO: Implement role listing in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_LIST_NOT_IMPLEMENTED',
        message: 'Role listing not yet implemented',
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_LIST_ERROR',
        message: 'Failed to retrieve roles',
      });
    }
  }

  @Post('roles')
  @ApiOperation({
    summary: 'Create role',
    description: 'Create a new role with optional initial permissions',
  })
  @ApiResponse({
    status: 201,
    description: 'Role created successfully',
    type: RoleWithPermissionsDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid role data' })
  @ApiResponse({ status: 409, description: 'Role already exists' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @HttpCode(HttpStatus.CREATED)
  async createRole(@Body() createRoleDto: CreateRoleDto): Promise<RoleWithPermissionsDto> {
    try {
      // TODO: Implement role creation in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_CREATE_NOT_IMPLEMENTED',
        message: 'Role creation not yet implemented',
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_CREATE_ERROR',
        message: 'Failed to create role',
      });
    }
  }

  @Get('roles/:id')
  @ApiOperation({
    summary: 'Get role with permissions',
    description: 'Retrieve a role by ID including its assigned permissions',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Role retrieved successfully',
    type: RoleWithPermissionsDto,
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getRole(@Param('id') id: string): Promise<RoleWithPermissionsDto> {
    try {
      // TODO: Implement get role by ID in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_GET_NOT_IMPLEMENTED',
        message: 'Get role not yet implemented',
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_GET_ERROR',
        message: 'Failed to retrieve role',
      });
    }
  }

  @Put('roles/:id')
  @ApiOperation({
    summary: 'Update role',
    description: 'Update an existing role',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Role updated successfully',
    type: RoleWithPermissionsDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid role data' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: Partial<CreateRoleDto>
  ): Promise<RoleWithPermissionsDto> {
    try {
      // TODO: Implement role update in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_UPDATE_NOT_IMPLEMENTED',
        message: 'Role update not yet implemented',
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_UPDATE_ERROR',
        message: 'Failed to update role',
      });
    }
  }

  @Delete('roles/:id')
  @ApiOperation({
    summary: 'Delete role',
    description: 'Delete a role from the system',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 204, description: 'Role deleted successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Role is in use and cannot be deleted' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRole(@Param('id') id: string): Promise<void> {
    try {
      // TODO: Implement role deletion in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_DELETE_NOT_IMPLEMENTED',
        message: 'Role deletion not yet implemented',
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_DELETE_ERROR',
        message: 'Failed to delete role',
      });
    }
  }

  @Post('roles/:id/permissions')
  @ApiOperation({
    summary: 'Assign permissions to role',
    description: 'Assign one or more permissions to a role',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Permissions assigned successfully',
    type: RoleWithPermissionsDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid permission assignments' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async assignPermissionsToRole(
    @Param('id') roleId: string,
    @Body() assignPermissionsDto: AssignPermissionsDto
  ): Promise<RoleWithPermissionsDto> {
    try {
      // TODO: Implement role permission assignment in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_ASSIGN_PERMISSIONS_NOT_IMPLEMENTED',
        message: 'Role permission assignment not yet implemented',
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_ASSIGN_PERMISSIONS_ERROR',
        message: 'Failed to assign permissions to role',
      });
    }
  }

  @Delete('roles/:id/permissions/:permissionId')
  @ApiOperation({
    summary: 'Remove permission from role',
    description: 'Remove a specific permission from a role',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiResponse({ status: 204, description: 'Permission removed successfully' })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePermissionFromRole(
    @Param('id') roleId: string,
    @Param('permissionId') permissionId: string
  ): Promise<void> {
    try {
      // TODO: Implement role permission removal in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_REMOVE_PERMISSION_NOT_IMPLEMENTED',
        message: 'Role permission removal not yet implemented',
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLES_REMOVE_PERMISSION_ERROR',
        message: 'Failed to remove permission from role',
      });
    }
  }

  // ========================================
  // USER PERMISSION MANAGEMENT ENDPOINTS
  // ========================================

  @Get('users/:userId/permissions')
  @ApiOperation({
    summary: 'Get user effective permissions',
    description: 'Get all effective permissions for a user (role-based + direct)',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'company_id', required: false, description: 'Company context for permissions' })
  @ApiQuery({ name: 'force_refresh', required: false, description: 'Force refresh from database' })
  @ApiResponse({
    status: 200,
    description: 'User permissions retrieved successfully',
    type: UserPermissionsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to access user permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getUserPermissions(
    @Param('userId') userId: string,
    @CurrentUser() requestingUser: User,
    @Query('company_id') companyId?: string,
    @Query('force_refresh') forceRefresh?: boolean
  ): Promise<UserPermissionsResponseDto> {
    try {
      // Call the new service method that handles authorization
      const effectivePermissions = await this.permissionsService.getPermissionsForUser(
        userId,
        requestingUser,
        forceRefresh || false
      );

      // Transform service response to API response
      return {
        user_id: effectivePermissions.user_id,
        permissions: effectivePermissions.permissions.map((p) => ({
          id: '', // TODO: Add ID mapping when permission CRUD is implemented
          name: p.name,
          description: undefined,
          category: p.category,
          source: p.source as any, // Cast to API enum
          source_role_id: p.source_role_id,
          source_role_name: p.source_role_name,
          expires_at: p.expires_at,
        })),
        roles: [], // TODO: Load roles when role CRUD is implemented
        calculated_at: effectivePermissions.calculated_at,
        from_cache: effectivePermissions.from_cache,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_PERMISSIONS_ERROR',
        message: 'Failed to retrieve user permissions',
      });
    }
  }

  @Post('users/:userId/permissions')
  @ApiOperation({
    summary: 'Grant direct permission to user',
    description: 'Grant a direct permission to a user (bypasses roles)',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 201, description: 'Permission granted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid permission grant' })
  @ApiResponse({ status: 404, description: 'User or permission not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @HttpCode(HttpStatus.CREATED)
  async grantUserPermission(
    @Param('userId') userId: string,
    @Body() grantDto: GrantUserPermissionDto
  ): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: Implement direct permission granting in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_GRANT_PERMISSION_NOT_IMPLEMENTED',
        message: 'Direct permission granting not yet implemented',
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_GRANT_PERMISSION_ERROR',
        message: 'Failed to grant permission to user',
      });
    }
  }

  @Delete('users/:userId/permissions/:permissionId')
  @ApiOperation({
    summary: 'Revoke direct permission from user',
    description: 'Revoke a direct permission from a user',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiResponse({ status: 204, description: 'Permission revoked successfully' })
  @ApiResponse({ status: 404, description: 'User or permission not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeUserPermission(
    @Param('userId') userId: string,
    @Param('permissionId') permissionId: string
  ): Promise<void> {
    try {
      // TODO: Implement direct permission revocation in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_REVOKE_PERMISSION_NOT_IMPLEMENTED',
        message: 'Direct permission revocation not yet implemented',
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_REVOKE_PERMISSION_ERROR',
        message: 'Failed to revoke permission from user',
      });
    }
  }

  @Post('users/:userId/roles')
  @ApiOperation({
    summary: 'Assign role to user',
    description: 'Assign a role to a user',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid role assignment' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @HttpCode(HttpStatus.CREATED)
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Body() assignRoleDto: AssignRoleToUserDto
  ): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: Implement role assignment in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_ASSIGN_ROLE_NOT_IMPLEMENTED',
        message: 'Role assignment not yet implemented',
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_ASSIGN_ROLE_ERROR',
        message: 'Failed to assign role to user',
      });
    }
  }

  @Delete('users/:userId/roles/:roleId')
  @ApiOperation({
    summary: 'Remove role from user',
    description: 'Remove a role assignment from a user',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({ status: 204, description: 'Role removed successfully' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRoleFromUser(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string
  ): Promise<void> {
    try {
      // TODO: Implement role removal in PermissionsService
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_REMOVE_ROLE_NOT_IMPLEMENTED',
        message: 'Role removal not yet implemented',
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_REMOVE_ROLE_ERROR',
        message: 'Failed to remove role from user',
      });
    }
  }

  @Post('users/:userId/permissions/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if user has specific permissions',
    description: 'Check if a user has one or more permissions',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission check completed',
    type: PermissionCheckResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid permission check request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to check user permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async checkUserPermissions(
    @Param('userId') userId: string,
    @CurrentUser() requestingUser: User,
    @Body() checkDto: CheckUserPermissionDto | { permission_names: string[]; company_id?: string }
  ): Promise<PermissionCheckResponseDto | { results: PermissionCheckResponseDto[] }> {
    try {
      // Handle single permission check
      if ('permission_name' in checkDto) {
        const result = await this.permissionsService.checkPermissionForUser(
          userId,
          requestingUser,
          checkDto.permission_name,
          checkDto.company_id
        );

        return {
          has_permission: result.granted,
          permission_name: result.permission_name,
          source: result.source as any, // Cast to API enum
          source_role_name: result.source_role_name,
          checked_at: result.checked_at,
        };
      }

      // Handle bulk permission check
      if ('permission_names' in checkDto) {
        const bulkResult = await this.permissionsService.checkPermissionsForUser(
          userId,
          requestingUser,
          checkDto.permission_names,
          checkDto.company_id
        );

        return {
          results: bulkResult.results.map((r) => ({
            has_permission: r.granted,
            permission_name: r.permission_name,
            source: r.source as any, // Cast to API enum
            source_role_name: r.source_role_name,
            checked_at: r.checked_at,
          })),
        };
      }

      throw new BadRequestException({
        success: false,
        code: 'INVALID_PERMISSION_CHECK',
        message: 'Must provide either permission_name or permission_names',
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_PERMISSION_CHECK_ERROR',
        message: 'Failed to check user permissions',
      });
    }
  }

  // ========================================
  // CACHE MANAGEMENT ENDPOINTS
  // ========================================

  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invalidate permission cache',
    description: 'Invalidate permission cache entries based on criteria',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache invalidated successfully',
    type: CacheInvalidationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid invalidation criteria' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async invalidateCache(
    @Body() invalidateDto: InvalidateCacheDto
  ): Promise<CacheInvalidationResponseDto> {
    try {
      return await this.permissionsService.invalidateCache(invalidateDto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'CACHE_INVALIDATE_ERROR',
        message: 'Failed to invalidate cache',
      });
    }
  }

  @Get('cache/stats')
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Retrieve permission cache statistics and metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
    type: CacheStatisticsDto,
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getCacheStatistics(): Promise<CacheStatisticsDto> {
    try {
      return await this.permissionsService.getCacheStatistics();
    } catch (error) {
      throw new InternalServerErrorException({
        success: false,
        code: 'CACHE_STATS_ERROR',
        message: 'Failed to retrieve cache statistics',
      });
    }
  }

  @Post('cache/warmup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Warm up permission cache',
    description: 'Pre-load permissions into cache for better performance',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache warmed up successfully',
    type: CacheWarmupResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid warmup criteria' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async warmupCache(@Body() warmupDto: CacheWarmupDto): Promise<CacheWarmupResponseDto> {
    try {
      return await this.permissionsService.warmupCache(warmupDto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'CACHE_WARMUP_ERROR',
        message: 'Failed to warm up cache',
      });
    }
  }

  // ========================================
  // SUPER ADMIN ENDPOINTS
  // ========================================

  @Get('users/:userId/super-admin-status')
  @ApiOperation({
    summary: 'Check super admin status',
    description: 'Check if a user has super admin privileges',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'company_id', required: false, description: 'Company context for check' })
  @ApiResponse({
    status: 200,
    description: 'Super admin status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        is_super_admin: { type: 'boolean' },
        method: { type: 'string', enum: ['role_based', 'permission_based', 'none'] },
        checked_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to check user status' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async checkSuperAdminStatus(
    @Param('userId') userId: string,
    @CurrentUser() requestingUser: User,
    @Query('company_id') companyId?: string
  ): Promise<{
    user_id: string;
    is_super_admin: boolean;
    method: 'role_based' | 'permission_based' | 'none';
    checked_at: Date;
  }> {
    try {
      // Validate access first (only self or other admins can check)
      await this.permissionsService['validateAccess'](userId, requestingUser);

      const isSuperAdmin = await this.permissionsService.isSuperAdmin(userId, companyId);

      // Determine method used
      let method: 'role_based' | 'permission_based' | 'none' = 'none';
      if (isSuperAdmin) {
        // Check which method detected super admin status
        const user = await this.permissionsService['userModel'].findByPk(userId, {
          attributes: ['role_id'],
          include: [
            {
              model: Role,
              attributes: ['name'],
              required: true,
            },
          ],
        });
        if (user?.role?.name === 'Super Admin') {
          method = 'role_based';
        } else {
          method = 'permission_based';
        }
      }

      return {
        user_id: userId,
        is_super_admin: isSuperAdmin,
        method,
        checked_at: new Date(),
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException({
        success: false,
        code: 'SUPER_ADMIN_CHECK_ERROR',
        message: 'Failed to check super admin status',
      });
    }
  }
}
