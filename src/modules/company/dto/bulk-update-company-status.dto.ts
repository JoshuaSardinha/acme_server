import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyStatus } from '../entities/company.entity';

export class CompanyStatusUpdateItem {
  @IsUUID(4, { message: 'Company ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Company ID is required' })
  companyId: string;

  @IsEnum(CompanyStatus, {
    message: `Status must be one of: ${Object.values(CompanyStatus).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Status is required' })
  status: CompanyStatus;

  @IsString({ message: 'Reason must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  reason?: string;
}

export class BulkUpdateCompanyStatusDto {
  @IsArray({ message: 'Updates must be an array' })
  @ValidateNested({ each: true })
  @Type(() => CompanyStatusUpdateItem)
  @ArrayMinSize(1, { message: 'At least one update is required' })
  @ArrayMaxSize(50, { message: 'Cannot update more than 50 companies at once' })
  updates: CompanyStatusUpdateItem[];
}
