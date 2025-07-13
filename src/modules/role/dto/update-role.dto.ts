import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../../auth/entities/user.entity';

export class UpdateRoleDto {
  @IsEnum(UserRole, {
    message: 'Invalid role',
  })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;
}
