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

export class RegisterVendorDto {
  @ApiProperty({
    description: 'Company name',
    example: 'Acme Legal Services',
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
    example: '123 Legal Street, Legal City, LC 12345',
  })
  @IsString()
  @IsOptional()
  @Length(0, 500, { message: 'Address cannot exceed 500 characters' })
  address?: string;

  @ApiProperty({
    description: 'Company email address',
    example: 'contact@acmelegal.com',
  })
  @IsEmail({}, { message: 'Please provide a valid company email address' })
  @IsNotEmpty()
  companyEmail: string;

  @ApiProperty({
    description: 'Company phone number',
    required: false,
    example: '+1-555-123-4567',
  })
  @IsString()
  @IsOptional()
  @Length(0, 20, { message: 'Phone number cannot exceed 20 characters' })
  @Matches(/^[\+]?[\s\d\-\(\)]+$/, { message: 'Please provide a valid phone number' })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Company subdomain (lowercase alphanumeric with hyphens)',
    example: 'acme-legal',
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
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50, { message: 'First name must be between 1 and 50 characters' })
  adminFirstName: string;

  @ApiProperty({
    description: 'Admin user last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50, { message: 'Last name must be between 1 and 50 characters' })
  adminLastName: string;

  @ApiProperty({
    description: 'Admin user email address',
    example: 'john.doe@acmelegal.com',
  })
  @IsEmail({}, { message: 'Please provide a valid admin email address' })
  @IsNotEmpty()
  adminEmail: string;

  @ApiProperty({
    description: 'Auth0 user ID for the admin user',
    example: 'auth0|507f1f77bcf86cd799439011',
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
    example: 'starter',
  })
  @IsString()
  @IsOptional()
  @Length(0, 50, { message: 'Subscription type cannot exceed 50 characters' })
  subscriptionType?: string;
}
