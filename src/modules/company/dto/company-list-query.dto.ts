import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { CompanyType, CompanyStatus } from '../entities/company.entity';
import { PaginationDto } from './pagination.dto';

export class CompanyListQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(CompanyType, {
    message: `Company type must be one of: ${Object.values(CompanyType).join(', ')}`,
  })
  type?: CompanyType;

  @IsOptional()
  @IsEnum(CompanyStatus, {
    message: `Status must be one of: ${Object.values(CompanyStatus).join(', ')}`,
  })
  status?: CompanyStatus;

  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  @MaxLength(100, { message: 'Search query must not exceed 100 characters' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'Sort by field must be a string' })
  @Transform(({ value }) => value?.toLowerCase())
  sortBy?: 'name' | 'created_at' | 'status' | 'type';

  @IsOptional()
  @IsString({ message: 'Sort order must be a string' })
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder?: 'asc' | 'desc';
}
