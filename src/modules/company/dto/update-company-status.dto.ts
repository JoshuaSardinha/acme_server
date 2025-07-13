import { IsEnum, IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CompanyStatus } from '../entities/company.entity';

export class UpdateCompanyStatusDto {
  @ApiProperty({
    description: 'New company status',
    enum: CompanyStatus,
    example: CompanyStatus.SUSPENDED,
    enumName: 'CompanyStatus',
  })
  @IsEnum(CompanyStatus, {
    message: `Status must be one of: ${Object.values(CompanyStatus).join(', ')}`,
  })
  status: CompanyStatus;

  @ApiProperty({
    description: 'Reason for status change (required for suspensions and rejections)',
    required: false,
    example: 'Violation of terms of service',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @Length(0, 500, { message: 'Reason cannot exceed 500 characters' })
  reason?: string;
}
