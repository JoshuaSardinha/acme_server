import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

/**
 * Role DTO for user profile response
 */
@Exclude()
export class RoleDto {
  @Expose()
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426655440000',
    description: 'Role ID',
  })
  id: string;

  @Expose()
  @ApiProperty({
    example: 'Acme Admin',
    description: 'Role display name',
  })
  name: string;

  @Expose()
  @ApiProperty({
    example: 'acme_admin',
    description: 'Role code (snake_case identifier)',
  })
  code: string;
}

/**
 * Company DTO for user profile response
 */
@Exclude()
export class CompanyDto {
  @Expose()
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426655440000',
    description: 'Company ID',
  })
  id: string;

  @Expose()
  @ApiProperty({
    example: 'Acme Corporation',
    description: 'Company name',
  })
  name: string;

  @Expose()
  @ApiProperty({
    example: '123 Main St, City, State 12345',
    description: 'Company address',
    required: false,
  })
  address?: string;

  @Expose()
  @ApiProperty({
    example: 'contact@acme.com',
    description: 'Company email',
    required: false,
  })
  email?: string;

  @Expose()
  @ApiProperty({
    example: '+1-555-123-4567',
    description: 'Company phone number',
    required: false,
  })
  phone_number?: string;

  @Expose()
  @ApiProperty({
    example: 'VENDOR',
    description: 'Company type',
    enum: ['ACME', 'VENDOR'],
  })
  type: string;

  @Expose()
  @ApiProperty({
    example: 'ACTIVE',
    description: 'Company status',
    enum: ['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED'],
  })
  status: string;

  @Expose()
  @ApiProperty({
    example: 'acme',
    description: 'Company subdomain',
    required: false,
  })
  subdomain?: string;
}

/**
 * Base profile DTO with common fields for all user profiles
 * This is the parent class for both own and other user profiles
 */
@Exclude()
export class BaseUserProfileDto {
  @Expose()
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  email: string;

  @Expose()
  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  firstName: string;

  @Expose()
  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  lastName: string;

  @Expose()
  @ApiProperty({
    example: 'Acme Corporation',
    description: 'Company name the user belongs to',
    deprecated: true,
  })
  companyName: string;

  @Expose()
  @Type(() => CompanyDto)
  @ApiProperty({
    description: 'Full company object the user belongs to',
    type: CompanyDto,
    required: false,
  })
  company?: CompanyDto | null;

  @Expose()
  @Type(() => RoleDto)
  @ApiProperty({
    description: 'User role object with id, name, and code',
    type: RoleDto,
  })
  role?: RoleDto | null;
}

/**
 * Response DTO for GET /users/me endpoint
 * Includes sensitive information that should only be shown to the user themselves
 */
@Exclude()
export class OwnUserProfileDto extends BaseUserProfileDto {
  @Expose()
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426655440000',
    description: 'User ID',
  })
  id: string;

  @Expose()
  @Type(() => String)
  @ApiProperty({
    example: ['users:read', 'teams:create', 'documents:upload'],
    description: 'Array of effective permission names for the user',
    isArray: true,
    type: String,
  })
  permissions: string[];

  @Expose()
  @ApiProperty({
    example: 'auth0|123456789',
    description: 'Auth0 user ID',
  })
  auth0id: string;

  @Expose()
  @ApiProperty({
    example: 'ACTIVE',
    description: 'User status',
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED'],
  })
  status: string;
}

/**
 * Response DTO for viewing other users' profiles
 * Excludes sensitive information for security
 */
@Exclude()
export class OtherUserProfileDto extends BaseUserProfileDto {
  @Expose()
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426655440000',
    description: 'User ID',
  })
  id: string;

  @Expose()
  @ApiProperty({
    example: 'ACTIVE',
    description: 'User status',
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED'],
  })
  status: string;
}
