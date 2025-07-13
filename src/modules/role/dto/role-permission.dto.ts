import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsString, IsUUID, IsOptional, IsArray, IsBoolean, IsDate } from 'class-validator';
import { PermissionDto } from './permission.dto';

// Role with Permissions Response DTO
export class RoleWithPermissionsDto {
  @ApiProperty({ description: 'Role unique identifier' })
  @Expose()
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Role name' })
  @Expose()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Role description' })
  @Expose()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Company ID' })
  @Expose()
  @IsUUID()
  company_id: string;

  @ApiProperty({ description: 'Whether this is a system role' })
  @Expose()
  @IsBoolean()
  is_system_role: boolean;

  @ApiProperty({ type: [PermissionDto], description: 'Permissions assigned to this role' })
  @Expose()
  @Type(() => PermissionDto)
  permissions: PermissionDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  @Expose()
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @Expose()
  updated_at: Date;
}

// Create Role Request DTO
export class CreateRoleDto {
  @ApiProperty({ description: 'Role name', example: 'Senior Attorney' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Role description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Company ID' })
  @IsUUID()
  company_id: string;

  @ApiPropertyOptional({
    description: 'Initial permissions to assign to role',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  permission_ids?: string[];
}

// Role Assignment to User DTO
export class AssignRoleToUserDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Role ID' })
  @IsUUID()
  role_id: string;

  @ApiPropertyOptional({ description: 'Assignment expiration date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expires_at?: Date;
}

// Bulk Role Assignment DTO
export class BulkRoleAssignmentDto {
  @ApiProperty({
    description: 'Array of user IDs',
    type: [String],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  user_ids: string[];

  @ApiProperty({ description: 'Role ID to assign' })
  @IsUUID()
  role_id: string;

  @ApiPropertyOptional({ description: 'Assignment expiration date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expires_at?: Date;
}

// Remove Role from User DTO
export class RemoveRoleFromUserDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Role ID' })
  @IsUUID()
  role_id: string;
}

// Role Query DTO
export class RoleQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by company ID' })
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @ApiPropertyOptional({ description: 'Search by role name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Include system roles' })
  @IsOptional()
  @IsBoolean()
  include_system_roles?: boolean = false;

  @ApiPropertyOptional({ description: 'Include permissions in response' })
  @IsOptional()
  @IsBoolean()
  include_permissions?: boolean = false;
}

// Role List Response DTO
export class RoleListResponseDto {
  @ApiProperty({ type: [RoleWithPermissionsDto] })
  @Expose()
  @Type(() => RoleWithPermissionsDto)
  roles: RoleWithPermissionsDto[];

  @ApiProperty({ description: 'Total count of roles' })
  @Expose()
  total: number;

  @ApiProperty({ description: 'Current page number' })
  @Expose()
  page: number;

  @ApiProperty({ description: 'Items per page' })
  @Expose()
  limit: number;
}
