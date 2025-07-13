import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsString, IsUUID, IsOptional, IsArray, IsBoolean } from 'class-validator';

// Base Permission DTO
export class PermissionDto {
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

  @ApiProperty({ description: 'Creation timestamp' })
  @Expose()
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @Expose()
  updated_at: Date;
}

// Create Permission Request DTO
export class CreatePermissionDto {
  @ApiProperty({ description: 'Permission name', example: 'CREATE_PETITION' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Permission description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Permission category', example: 'PETITION_MANAGEMENT' })
  @IsOptional()
  @IsString()
  category?: string;
}

// Update Permission Request DTO
export class UpdatePermissionDto {
  @ApiPropertyOptional({ description: 'Permission name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Permission description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Permission category' })
  @IsOptional()
  @IsString()
  category?: string;
}

// Permission List Response DTO
export class PermissionListResponseDto {
  @ApiProperty({ type: [PermissionDto] })
  @Expose()
  @Type(() => PermissionDto)
  permissions: PermissionDto[];

  @ApiProperty({ description: 'Total count of permissions' })
  @Expose()
  total: number;

  @ApiProperty({ description: 'Current page number' })
  @Expose()
  page: number;

  @ApiProperty({ description: 'Items per page' })
  @Expose()
  limit: number;
}

// Permission Query/Filter DTO
export class PermissionQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;
}

// Bulk Permission Operations DTO
export class BulkPermissionOperationDto {
  @ApiProperty({
    description: 'Array of permission IDs',
    type: [String],
    example: ['perm-123', 'perm-456'],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  permission_ids: string[];
}

// Permission Assignment DTO (for roles/users)
export class AssignPermissionsDto {
  @ApiProperty({
    description: 'Array of permission IDs to assign',
    type: [String],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  permission_ids: string[];

  @ApiPropertyOptional({ description: 'Replace existing permissions instead of adding' })
  @IsOptional()
  @IsBoolean()
  replace?: boolean = false;
}

// Remove Permissions DTO
export class RemovePermissionsDto {
  @ApiProperty({
    description: 'Array of permission IDs to remove',
    type: [String],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  permission_ids: string[];
}
