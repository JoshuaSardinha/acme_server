import { IsEmail, IsNotEmpty, IsString, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum VendorRole {
  VENDOR_EMPLOYEE = 'vendor_employee',
  VENDOR_MANAGER = 'vendor_manager',
}

export class VendorInviteDto {
  @ApiProperty({
    example: 'jane.smith@vendorcorp.com',
    description: 'Email address of the user to invite',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Jane',
    description: 'First name of the user',
  })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({
    example: 'Smith',
    description: 'Last name of the user',
  })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    enum: VendorRole,
    example: VendorRole.VENDOR_EMPLOYEE,
    description: 'Role to assign to the new user (Vendor roles only - cannot assign admin roles)',
  })
  @IsEnum(VendorRole, {
    message:
      'Role must be a valid vendor role (vendor_employee or vendor_manager). Cannot assign admin roles.',
  })
  @IsNotEmpty()
  role: VendorRole;

  @ApiProperty({
    example: true,
    description: 'Whether the user is a lawyer',
  })
  @IsBoolean()
  @IsNotEmpty()
  is_lawyer: boolean;

  @ApiProperty({
    example: 'optional-company-id',
    description: 'Company ID (ignored - inviter company is used for security)',
    required: false,
  })
  @IsOptional()
  @IsString()
  company_id?: string; // Optional field that gets ignored for security
}
