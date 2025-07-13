import { IsArray, IsEnum, IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../auth/entities/user.entity';

export class SearchCompanyUsersDto {
  @IsOptional()
  @IsString({ message: 'Search value must be a string' })
  @MaxLength(100, { message: 'Search value must not exceed 100 characters' })
  searchValue?: string;

  @IsOptional()
  @IsBoolean({ message: 'isLawyer must be a boolean' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  isLawyer?: boolean;

  @IsOptional()
  @IsArray({ message: 'Roles must be an array' })
  @IsEnum(UserRole, {
    each: true,
    message: `Each role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return Array.isArray(value) ? value : [];
  })
  roles?: UserRole[];
}
