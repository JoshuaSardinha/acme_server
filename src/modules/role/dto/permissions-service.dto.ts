import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsString, IsUUID, IsOptional, IsBoolean, IsDate, IsEnum } from 'class-validator';

// Permission Source for the PermissionsService
export enum PermissionSourceType {
  ROLE = 'ROLE',
  DIRECT = 'DIRECT',
  SYSTEM = 'SYSTEM',
}

// Effective Permission for PermissionsService
export class ServiceEffectivePermissionDto {
  @ApiProperty({ description: 'Permission name' })
  @Expose()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Permission category' })
  @Expose()
  @IsString()
  category: string;

  @ApiProperty({
    enum: PermissionSourceType,
    description: 'How the permission was granted',
  })
  @Expose()
  @IsEnum(PermissionSourceType)
  source: PermissionSourceType;

  @ApiPropertyOptional({ description: 'Role ID if from role' })
  @Expose()
  @IsOptional()
  @IsUUID()
  source_role_id?: string;

  @ApiPropertyOptional({ description: 'Role name if from role' })
  @Expose()
  @IsOptional()
  @IsString()
  source_role_name?: string;

  @ApiPropertyOptional({ description: 'Permission expiration' })
  @Expose()
  @IsOptional()
  @IsDate()
  expires_at?: Date;

  @ApiProperty({ description: 'Whether permission is currently active' })
  @Expose()
  @IsBoolean()
  is_active: boolean;
}

// Main DTO for getEffectivePermissionsForUser method
export class UserEffectivePermissionsDto {
  @ApiProperty({ description: 'User ID' })
  @Expose()
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Company ID' })
  @Expose()
  @IsUUID()
  company_id: string;

  @ApiProperty({
    type: [ServiceEffectivePermissionDto],
    description: 'All effective permissions for the user',
  })
  @Expose()
  @Type(() => ServiceEffectivePermissionDto)
  permissions: ServiceEffectivePermissionDto[];

  @ApiProperty({ description: 'Permission names for quick access', type: [String] })
  @Expose()
  permission_names: string[];

  @ApiProperty({ description: 'When permissions were calculated' })
  @Expose()
  @IsDate()
  calculated_at: Date;

  @ApiProperty({ description: 'Whether data came from cache' })
  @Expose()
  @IsBoolean()
  from_cache: boolean;

  @ApiProperty({ description: 'Cache TTL in seconds' })
  @Expose()
  cache_ttl_seconds: number;
}

// PermissionsService Configuration DTO
export class PermissionsServiceConfigDto {
  @ApiProperty({ description: 'Cache TTL for user permissions in seconds' })
  @Expose()
  cache_ttl_seconds: number;

  @ApiProperty({ description: 'Maximum cache entries' })
  @Expose()
  max_cache_entries: number;

  @ApiProperty({ description: 'Whether caching is enabled' })
  @Expose()
  cache_enabled: boolean;

  @ApiProperty({ description: 'Background refresh interval in seconds' })
  @Expose()
  background_refresh_interval: number;

  @ApiProperty({ description: 'Whether to include system permissions' })
  @Expose()
  include_system_permissions: boolean;
}

// Permission Check Request for PermissionsService
export class ServicePermissionCheckDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Permission name to check' })
  @IsString()
  permission_name: string;

  @ApiPropertyOptional({ description: 'Company context' })
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @ApiPropertyOptional({ description: 'Force fresh data (skip cache)' })
  @IsOptional()
  @IsBoolean()
  force_refresh?: boolean = false;
}

// Permission Check Result from PermissionsService
export class ServicePermissionCheckResultDto {
  @ApiProperty({ description: 'Whether user has the permission' })
  @Expose()
  @IsBoolean()
  granted: boolean;

  @ApiProperty({ description: 'Permission name checked' })
  @Expose()
  @IsString()
  permission_name: string;

  @ApiProperty({ description: 'User ID' })
  @Expose()
  @IsUUID()
  user_id: string;

  @ApiPropertyOptional({
    enum: PermissionSourceType,
    description: 'How the permission was granted (if granted)',
  })
  @Expose()
  @IsOptional()
  @IsEnum(PermissionSourceType)
  source?: PermissionSourceType;

  @ApiPropertyOptional({ description: 'Role that granted permission' })
  @Expose()
  @IsOptional()
  @IsString()
  source_role_name?: string;

  @ApiProperty({ description: 'Check timestamp' })
  @Expose()
  @IsDate()
  checked_at: Date;

  @ApiProperty({ description: 'Whether result came from cache' })
  @Expose()
  @IsBoolean()
  from_cache: boolean;
}

// Bulk Permission Check for PermissionsService
export class ServiceBulkPermissionCheckDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({
    description: 'Permission names to check',
    type: [String],
  })
  @IsString({ each: true })
  permission_names: string[];

  @ApiPropertyOptional({ description: 'Company context' })
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @ApiPropertyOptional({ description: 'Force fresh data (skip cache)' })
  @IsOptional()
  @IsBoolean()
  force_refresh?: boolean = false;
}

// Bulk Permission Check Result
export class ServiceBulkPermissionCheckResultDto {
  @ApiProperty({ description: 'User ID' })
  @Expose()
  @IsUUID()
  user_id: string;

  @ApiProperty({
    description: 'Permission check results',
    type: [ServicePermissionCheckResultDto],
  })
  @Expose()
  @Type(() => ServicePermissionCheckResultDto)
  results: ServicePermissionCheckResultDto[];

  @ApiProperty({ description: 'Total permissions checked' })
  @Expose()
  total_checked: number;

  @ApiProperty({ description: 'Number of permissions granted' })
  @Expose()
  granted_count: number;

  @ApiProperty({ description: 'Check timestamp' })
  @Expose()
  @IsDate()
  checked_at: Date;

  @ApiProperty({ description: 'Whether results came from cache' })
  @Expose()
  @IsBoolean()
  from_cache: boolean;
}

// Cache Key Information for debugging
export class CacheKeyInfoDto {
  @ApiProperty({ description: 'Cache key' })
  @Expose()
  @IsString()
  key: string;

  @ApiProperty({ description: 'Key type' })
  @Expose()
  @IsString()
  type: 'user_permissions' | 'permission_check' | 'role_permissions';

  @ApiProperty({ description: 'User ID in key' })
  @Expose()
  @IsUUID()
  user_id: string;

  @ApiPropertyOptional({ description: 'Company ID in key' })
  @Expose()
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @ApiProperty({ description: 'When key was created' })
  @Expose()
  @IsDate()
  created_at: Date;

  @ApiProperty({ description: 'When key expires' })
  @Expose()
  @IsDate()
  expires_at: Date;

  @ApiProperty({ description: 'Whether key is expired' })
  @Expose()
  @IsBoolean()
  is_expired: boolean;
}
