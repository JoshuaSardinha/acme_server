import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminCreateVendorDto {
  @ApiProperty({
    description: 'Company name',
    example: 'Elite Legal Partners',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100, { message: 'Company name must be between 2 and 100 characters' })
  companyName: string;

  @ApiProperty({
    description: 'Company address',
    required: false,
    example: '456 Corporate Blvd, Business City, BC 67890',
  })
  @IsString()
  @IsOptional()
  @Length(0, 500, { message: 'Address cannot exceed 500 characters' })
  address?: string;

  @ApiProperty({
    description: 'Company email address',
    example: 'contact@elitelegal.com',
  })
  @IsEmail({}, { message: 'Please provide a valid company email address' })
  @IsNotEmpty()
  companyEmail: string;

  @ApiProperty({
    description: 'Company phone number',
    required: false,
    example: '+1-555-987-6543',
  })
  @IsString()
  @IsOptional()
  @Length(0, 20, { message: 'Phone number cannot exceed 20 characters' })
  @Matches(/^[\+]?[\s\d\-\(\)]+$/, { message: 'Please provide a valid phone number' })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Company subdomain (lowercase alphanumeric with hyphens)',
    example: 'elite-legal',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 50, { message: 'Subdomain must be between 3 and 50 characters' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Subdomain must contain only lowercase letters, numbers, and hyphens',
  })
  subdomain: string;

  @ApiProperty({
    description: 'Admin user first name',
    example: 'Jane',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50, { message: 'First name must be between 1 and 50 characters' })
  adminFirstName: string;

  @ApiProperty({
    description: 'Admin user last name',
    example: 'Smith',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50, { message: 'Last name must be between 1 and 50 characters' })
  adminLastName: string;

  @ApiProperty({
    description: 'Admin user email address',
    example: 'jane.smith@elitelegal.com',
  })
  @IsEmail({}, { message: 'Please provide a valid admin email address' })
  @IsNotEmpty()
  adminEmail: string;

  @ApiProperty({
    description: 'Auth0 user ID for the admin user',
    example: 'auth0|607f1f77bcf86cd799439022',
  })
  @IsString()
  @IsNotEmpty()
  auth0UserId: string;

  @ApiProperty({
    description: 'Whether the admin user is a lawyer',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isLawyer?: boolean;

  @ApiProperty({
    description: 'Subscription type',
    required: false,
    default: 'starter',
    example: 'professional',
  })
  @IsString()
  @IsOptional()
  @Length(0, 50, { message: 'Subscription type cannot exceed 50 characters' })
  subscriptionType?: string;

  @ApiProperty({
    description: 'Auto-approve the company after creation (admin privilege)',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  autoApprove?: boolean;
}
