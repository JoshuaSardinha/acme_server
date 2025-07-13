import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '../../auth/entities/user.entity';

export class AddUserToCompanyDto {
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @IsEnum(UserRole, {
    message: `Role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;

  @IsBoolean({ message: 'isLawyer must be a boolean' })
  @IsOptional()
  isLawyer?: boolean;
}
