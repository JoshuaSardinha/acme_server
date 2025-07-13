import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RemoveUserFromCompanyDto {
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @IsString({ message: 'Reason must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  reason?: string;
}
