import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { CompanyType, CompanyStatus } from '../entities/company.entity';

export class CreateCompanyDto {
  @IsString({ message: 'Company name must be a string' })
  @IsNotEmpty({ message: 'Company name is required' })
  @MinLength(2, { message: 'Company name must be at least 2 characters' })
  @MaxLength(100, { message: 'Company name must not exceed 100 characters' })
  name: string;

  @IsString({ message: 'Address must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Address must not exceed 500 characters' })
  address?: string;

  @IsEmail({}, { message: 'Invalid email format' })
  @IsOptional()
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  email?: string;

  @IsString({ message: 'Phone number must be a string' })
  @IsOptional()
  @Matches(/^\+?[\d\s\-\(\)]+$/, { message: 'Invalid phone number format' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  phoneNumber?: string;

  @IsEnum(CompanyType, {
    message: `Company type must be one of: ${Object.values(CompanyType).join(', ')}`,
  })
  @IsOptional()
  type?: CompanyType;

  @IsEnum(CompanyStatus, {
    message: `Status must be one of: ${Object.values(CompanyStatus).join(', ')}`,
  })
  @IsOptional()
  status?: CompanyStatus;

  @IsString({ message: 'Subscription type must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Subscription type must not exceed 50 characters' })
  subscriptionType?: string;

  @IsString({ message: 'Subscription status must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Subscription status must not exceed 50 characters' })
  subscriptionStatus?: string;

  @IsString({ message: 'Subdomain must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Subdomain must be at least 3 characters' })
  @MaxLength(50, { message: 'Subdomain must not exceed 50 characters' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Subdomain can only contain lowercase letters, numbers, and hyphens',
  })
  subdomain?: string;
}
