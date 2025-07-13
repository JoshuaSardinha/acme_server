import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { IsAcmeRole } from '../../../common/decorators/is-acme-role.decorator';
import { UserRole } from '../entities/user.entity';

export class AcmeInviteDto {
  @ApiProperty({
    example: 'john.doe@acme.com',
    description: 'Email address of the user to invite',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'First name of the user',
  })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name of the user',
  })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.ACME_EMPLOYEE,
    description: 'Role to assign to the new user (Acme roles only)',
  })
  @IsAcmeRole()
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({
    example: false,
    description: 'Whether the user is a lawyer',
  })
  @IsBoolean()
  @IsNotEmpty()
  is_lawyer: boolean;
}
