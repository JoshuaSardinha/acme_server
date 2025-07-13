import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CompanyType, CompanyStatus } from '../entities/company.entity';

export class AdminCreateCompanyDto {
  @ApiProperty({
    description: 'Company name',
    example: 'Enterprise Legal Solutions',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Company name must be a string' })
  @IsNotEmpty({ message: 'Company name is required' })
  @MinLength(2, { message: 'Company name must be at least 2 characters' })
  @MaxLength(100, { message: 'Company name must not exceed 100 characters' })
  name: string;

  @ApiProperty({
    description: 'Company address',
    required: false,
    example: '123 Business Ave, Suite 100',
    maxLength: 500,
  })
  @IsString({ message: 'Address must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Address must not exceed 500 characters' })
  address?: string;

  @ApiProperty({
    description: 'Company email address',
    required: false,
    example: 'contact@enterprise.com',
    format: 'email',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'Invalid company email format' })
  @IsOptional()
  @MaxLength(255, { message: 'Company email must not exceed 255 characters' })
  email?: string;

  @ApiProperty({
    description: 'Company phone number',
    required: false,
    example: '+1-555-0456',
    maxLength: 20,
  })
  @IsString({ message: 'Phone number must be a string' })
  @IsOptional()
  @Matches(/^\+?[\d\s\-\(\)]+$/, { message: 'Invalid phone number format' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Company type',
    enum: CompanyType,
    example: CompanyType.VENDOR,
    enumName: 'CompanyType',
  })
  @IsEnum(CompanyType, {
    message: `Company type must be one of: ${Object.values(CompanyType).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Company type is required' })
  type: CompanyType;

  @ApiProperty({
    description: 'Company status',
    enum: CompanyStatus,
    required: false,
    example: CompanyStatus.ACTIVE,
    enumName: 'CompanyStatus',
  })
  @IsEnum(CompanyStatus, {
    message: `Status must be one of: ${Object.values(CompanyStatus).join(', ')}`,
  })
  @IsOptional()
  status?: CompanyStatus;

  @ApiProperty({
    description: 'Subscription type',
    required: false,
    example: 'professional',
    maxLength: 50,
  })
  @IsString({ message: 'Subscription type must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Subscription type must not exceed 50 characters' })
  subscriptionType?: string;

  @ApiProperty({
    description: 'Subscription status',
    required: false,
    example: 'active',
    maxLength: 50,
  })
  @IsString({ message: 'Subscription status must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Subscription status must not exceed 50 characters' })
  subscriptionStatus?: string;

  @ApiProperty({
    description: 'Company subdomain',
    required: false,
    example: 'enterprise-legal',
    minLength: 3,
    maxLength: 50,
    pattern: '^[a-z0-9-]+$',
  })
  @IsString({ message: 'Subdomain must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Subdomain must be at least 3 characters' })
  @MaxLength(50, { message: 'Subdomain must not exceed 50 characters' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Subdomain can only contain lowercase letters, numbers, and hyphens',
  })
  subdomain?: string;

  @ApiProperty({
    description: 'Billing plan ID',
    required: false,
    example: '12345678-1234-1234-1234-123456789012',
    format: 'uuid',
  })
  @IsUUID(4, { message: 'Billing plan ID must be a valid UUID' })
  @IsOptional()
  billingPlanId?: string;

  @ApiProperty({
    description: 'Primary contact user ID',
    required: false,
    example: '12345678-1234-1234-1234-123456789012',
    format: 'uuid',
  })
  @IsUUID(4, { message: 'Primary contact user ID must be a valid UUID' })
  @IsOptional()
  primaryContactUserId?: string;

  @ApiProperty({
    description: 'Submitted documents reference',
    required: false,
    example: 'documents/company-registration-2024.pdf',
    maxLength: 1000,
  })
  @IsString({ message: 'Submitted documents reference must be a string' })
  @IsOptional()
  @MaxLength(1000, { message: 'Submitted documents reference must not exceed 1000 characters' })
  submittedDocumentsRef?: string;

  @ApiProperty({
    description: 'Owner user ID',
    required: false,
    example: '12345678-1234-1234-1234-123456789012',
    format: 'uuid',
  })
  @IsUUID(4, { message: 'Owner ID must be a valid UUID' })
  @IsOptional()
  ownerId?: string;
}
