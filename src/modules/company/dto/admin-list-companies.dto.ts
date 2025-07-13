import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CompanyStatus, CompanyType } from '../entities/company.entity';

export class AdminListCompaniesDto {
  @ApiProperty({
    description: 'Page number',
    required: false,
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by company status',
    enum: CompanyStatus,
    required: false,
    enumName: 'CompanyStatus',
    example: CompanyStatus.PENDING_APPROVAL,
  })
  @IsOptional()
  @IsEnum(CompanyStatus, {
    message: `Status must be one of: ${Object.values(CompanyStatus).join(', ')}`,
  })
  status?: CompanyStatus;

  @ApiProperty({
    description: 'Filter by company type',
    enum: CompanyType,
    required: false,
    enumName: 'CompanyType',
    example: CompanyType.VENDOR,
  })
  @IsOptional()
  @IsEnum(CompanyType, {
    message: `Type must be one of: ${Object.values(CompanyType).join(', ')}`,
  })
  type?: CompanyType;

  @ApiProperty({
    description: 'Search term for company name, email, or subdomain',
    required: false,
    example: 'acme',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  searchTerm?: string;

  @ApiProperty({
    description: 'Sort field',
    required: false,
    default: 'created_at',
    enum: ['created_at', 'updated_at', 'name', 'status'],
    example: 'created_at',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['created_at', 'updated_at', 'name', 'status'], {
    message: 'sortBy must be one of: created_at, updated_at, name, status',
  })
  sortBy?: string = 'created_at';

  @ApiProperty({
    description: 'Sort order',
    required: false,
    default: 'DESC',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  @IsEnum(['ASC', 'DESC'], {
    message: 'sortOrder must be either ASC or DESC',
  })
  sortOrder?: string = 'DESC';
}
