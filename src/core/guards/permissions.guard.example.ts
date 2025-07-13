/**
 * PermissionsGuard Usage Examples
 *
 * This file demonstrates various ways to use the PermissionsGuard
 * in NestJS controllers for fine-grained permission-based access control.
 */

import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from './permissions.guard';

/**
 * Example 1: Basic Permission Checking
 */
@Controller('users')
export class UsersController {
  // Single permission requirement
  @Get()
  @RequirePermissions('users:read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getUsers() {
    // Only users with 'users:read' permission can access this endpoint
    return { users: [] };
  }

  // Multiple permissions (user needs ANY of them)
  @Get('profile')
  @RequirePermissions('users:read', 'profile:read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getUserProfile() {
    // User needs EITHER 'users:read' OR 'profile:read'
    return { profile: {} };
  }

  // Create operation with specific permission
  @Post()
  @RequirePermissions('users:create')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async createUser(@Body() userData: any) {
    // Only users with 'users:create' permission can create users
    return { success: true };
  }

  // Update with multiple permissions required
  @Put(':id')
  @RequirePermissions('users:update', 'audit:log')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async updateUser(@Param('id') id: string, @Body() updateData: any) {
    // User needs BOTH 'users:update' AND 'audit:log' permissions
    return { success: true };
  }

  // Delete with super admin bypass
  @Delete(':id')
  @RequirePermissions('users:delete')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async deleteUser(@Param('id') id: string) {
    // Regular users need 'users:delete', super admins can bypass
    return { success: true };
  }
}

/**
 * Example 2: Admin-level Operations
 */
@Controller('admin')
export class AdminController {
  // System configuration access
  @Get('config')
  @RequirePermissions('admin:config:read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getSystemConfig() {
    return { config: {} };
  }

  // Bulk operations requiring multiple permissions
  @Post('bulk-user-import')
  @RequirePermissions('admin:users:import', 'admin:bulk:operations', 'audit:log')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async bulkImportUsers(@Body() importData: any) {
    // User needs ALL three permissions
    return { imported: 0 };
  }

  // Flexible admin access
  @Get('dashboard')
  @RequirePermissions('admin:dashboard:read', 'manager:dashboard:read', 'supervisor:dashboard:read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getAdminDashboard() {
    // User needs ANY of the dashboard permissions
    return { dashboard: {} };
  }
}

/**
 * Example 3: Company-specific Operations
 */
@Controller('companies')
export class CompaniesController {
  // Company management
  @Get(':companyId/users')
  @RequirePermissions('company:users:read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getCompanyUsers(@Param('companyId') companyId: string) {
    // Permission check will include company isolation
    return { users: [] };
  }

  // Company settings with strict requirements
  @Put(':companyId/settings')
  @RequirePermissions('company:settings:write', 'company:admin')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async updateCompanySettings(@Param('companyId') companyId: string, @Body() settings: any) {
    return { success: true };
  }
}

/**
 * Example 4: Team Management
 */
@Controller('teams')
export class TeamsController {
  // Team viewing with role flexibility
  @Get()
  @RequirePermissions('teams:read', 'team-member:read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getTeams() {
    return { teams: [] };
  }

  // Team creation with strict controls
  @Post()
  @RequirePermissions('teams:create')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async createTeam(@Body() teamData: any) {
    return { team: {} };
  }

  // Team deletion with audit requirements
  @Delete(':id')
  @RequirePermissions('teams:delete', 'audit:team-operations')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async deleteTeam(@Param('id') id: string) {
    return { success: true };
  }
}

/**
 * Example 5: Public endpoint (no permissions required)
 */
@Controller('public')
export class PublicController {
  // No permission decorator = no permission check
  @Get('health')
  @UseGuards(JwtAuthGuard) // Only authentication required
  async getHealthStatus() {
    return { status: 'healthy' };
  }

  // Optional permission check
  @Get('features')
  @RequirePermissions() // Empty permissions = allow all authenticated users
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getAvailableFeatures() {
    return { features: [] };
  }
}

/**
 * Example 6: Mixed Guard Usage
 */
@Controller('reports')
export class ReportsController {
  // Combine with other guards
  @Get('financial')
  @RequirePermissions('reports:financial:read')
  @UseGuards(JwtAuthGuard, PermissionsGuard /* , OtherGuard */)
  async getFinancialReports() {
    return { reports: [] };
  }

  // Class-level permissions (applied to all methods)
  @RequirePermissions('reports:access')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('sales')
  async getSalesReports() {
    // Inherits class-level permission requirements
    return { reports: [] };
  }
}

/**
 * Example 7: Error Handling
 */
@Controller('secure')
export class SecureController {
  @Get('data')
  @RequirePermissions('secure:data:read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getSecureData() {
    // This will throw ForbiddenException if user lacks permission
    // Error response will include:
    // - success: false
    // - code: 'INSUFFICIENT_PERMISSIONS'
    // - message: 'User lacks any of the required permissions: secure:data:read'
    // - details: { required_permissions, missing_permissions, user_id, company_id }
    return { data: 'classified' };
  }
}

/**
 * Module Setup Example
 */
import { Module } from '@nestjs/common';
import { RoleModule } from '../../modules/role/role.module';
import { CoreModule } from '../core.module';

@Module({
  imports: [
    RoleModule, // Provides PermissionsGuard and PermissionsService
    CoreModule, // Provides JwtAuthGuard and other core guards
  ],
  controllers: [
    UsersController,
    AdminController,
    CompaniesController,
    TeamsController,
    PublicController,
    ReportsController,
    SecureController,
  ],
})
export class ExampleModule {}

/**
 * Notes:
 *
 * 1. Always use JwtAuthGuard before PermissionsGuard
 * 2. Permission names should follow a consistent naming convention (e.g., 'resource:action')
 * 3. The guard automatically handles company-based multi-tenant isolation
 * 4. Super admin bypass is configurable per endpoint
 * 5. Caching is handled automatically by the PermissionsService
 * 6. Empty @RequirePermissions() decorator allows all authenticated users
 * 7. No decorator means no permission check (only authentication if JwtAuthGuard is used)
 */
