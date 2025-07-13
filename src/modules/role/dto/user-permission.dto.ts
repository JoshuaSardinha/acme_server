import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsString, IsUUID, IsOptional, IsArray, IsBoolean, IsDate, IsEnum } from 'class-validator';
import { RoleWithPermissionsDto } from './role-permission.dto';

// Permission Source Enum
export enum PermissionSource {
  ROLE = 'ROLE',
  DIRECT = 'DIRECT',
  INHERITED = 'INHERITED',
}

// Effective Permission DTO (includes source information)
export class EffectivePermissionDto {
  @ApiProperty({ description: 'Permission unique identifier' })
  @Expose()
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Permission name' })
  @Expose()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Permission description' })
  @Expose()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Permission category' })
  @Expose()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    enum: PermissionSource,
    description: 'How the user acquired this permission',
  })
  @Expose()
  @IsEnum(PermissionSource)
  source: PermissionSource;

  @ApiPropertyOptional({ description: 'Role ID if permission comes from a role' })
  @Expose()
  @IsOptional()
  @IsUUID()
  source_role_id?: string;

  @ApiPropertyOptional({ description: 'Role name if permission comes from a role' })
  @Expose()
  @IsOptional()
  @IsString()
  source_role_name?: string;

  @ApiPropertyOptional({ description: 'Permission expiration date' })
  @Expose()
  @IsOptional()
  @IsDate()
  expires_at?: Date;
}

// User Permissions Response DTO
export class UserPermissionsResponseDto {
  @ApiProperty({ description: 'User ID' })
  @Expose()
  @IsUUID()
  user_id: string;

  @ApiProperty({
    type: [EffectivePermissionDto],
    description: 'All effective permissions for the user',
  })
  @Expose()
  @Type(() => EffectivePermissionDto)
  permissions: EffectivePermissionDto[];

  @ApiProperty({ type: [RoleWithPermissionsDto], description: 'Roles assigned to the user' })
  @Expose()
  @Type(() => RoleWithPermissionsDto)
  roles: RoleWithPermissionsDto[];

  @ApiProperty({ description: 'Timestamp when permissions were calculated' })
  @Expose()
  calculated_at: Date;

  @ApiProperty({ description: 'Whether permissions are from cache' })
  @Expose()
  from_cache: boolean;
}

// Grant Direct Permission to User DTO
export class GrantUserPermissionDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Permission ID' })
  @IsUUID()
  permission_id: string;

  @ApiPropertyOptional({ description: 'Reason for granting permission' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Permission expiration date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expires_at?: Date;
}

// Revoke Direct Permission from User DTO
export class RevokeUserPermissionDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Permission ID' })
  @IsUUID()
  permission_id: string;

  @ApiPropertyOptional({ description: 'Reason for revoking permission' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// Bulk Grant Permissions to User DTO
export class BulkGrantUserPermissionsDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({
    description: 'Array of permission IDs to grant',
    type: [String],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  permission_ids: string[];

  @ApiPropertyOptional({ description: 'Reason for granting permissions' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Permission expiration date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expires_at?: Date;

  @ApiPropertyOptional({ description: 'Replace existing direct permissions' })
  @IsOptional()
  @IsBoolean()
  replace?: boolean = false;
}

// Check User Permission DTO
export class CheckUserPermissionDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Permission name to check' })
  @IsString()
  permission_name: string;

  @ApiPropertyOptional({ description: 'Check for specific company context' })
  @IsOptional()
  @IsUUID()
  company_id?: string;
}

// Permission Check Response DTO
export class PermissionCheckResponseDto {
  @ApiProperty({ description: 'Whether user has the permission' })
  @Expose()
  @IsBoolean()
  has_permission: boolean;

  @ApiProperty({ description: 'Permission name that was checked' })
  @Expose()
  @IsString()
  permission_name: string;

  @ApiProperty({
    enum: PermissionSource,
    description: 'How the user has this permission (if they do)',
  })
  @Expose()
  @IsOptional()
  @IsEnum(PermissionSource)
  source?: PermissionSource;

  @ApiPropertyOptional({ description: 'Role that granted the permission' })
  @Expose()
  @IsOptional()
  @IsString()
  source_role_name?: string;

  @ApiProperty({ description: 'Timestamp of the check' })
  @Expose()
  checked_at: Date;
}

// User Permission Query DTO
export class UserPermissionQueryDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  user_id: string;

  @ApiPropertyOptional({ description: 'Filter by permission category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Include expired permissions' })
  @IsOptional()
  @IsBoolean()
  include_expired?: boolean = false;

  @ApiPropertyOptional({ description: 'Include role-based permissions' })
  @IsOptional()
  @IsBoolean()
  include_role_permissions?: boolean = true;

  @ApiPropertyOptional({ description: 'Include direct permissions' })
  @IsOptional()
  @IsBoolean()
  include_direct_permissions?: boolean = true;

  @ApiPropertyOptional({ description: 'Force refresh from database (ignore cache)' })
  @IsOptional()
  @IsBoolean()
  force_refresh?: boolean = false;
}
