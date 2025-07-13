import { Exclude, Expose, Type } from 'class-transformer';
import { CompanyType, CompanyStatus } from '../entities/company.entity';
import { RoleDto } from '../../auth/dto/user-profile.dto';

export class UserSummaryDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  email: string;

  @Expose()
  @Type(() => RoleDto)
  role: RoleDto;

  @Expose()
  isLawyer: boolean;

  // Exclude sensitive fields
  @Exclude()
  auth0UserId: string;

  @Exclude()
  companyId: string;

  @Exclude()
  createdAt: Date;

  @Exclude()
  updatedAt: Date;
}

export class CompanyResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  address: string;

  @Expose()
  email: string;

  @Expose()
  phoneNumber: string;

  @Expose()
  type: CompanyType;

  @Expose()
  status: CompanyStatus;

  @Expose()
  subscriptionType: string;

  @Expose()
  subscriptionStatus: string;

  @Expose()
  subdomain: string;

  @Expose()
  @Type(() => UserSummaryDto)
  primaryContact?: UserSummaryDto;

  @Expose()
  @Type(() => UserSummaryDto)
  owner?: UserSummaryDto;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // Exclude sensitive fields
  @Exclude()
  billingPlanId: string;

  @Exclude()
  submittedDocumentsRef: string;

  @Exclude()
  primaryContactUserId: string;

  @Exclude()
  ownerId: string;
}

export class CompanyListResponseDto {
  @Expose()
  @Type(() => CompanyResponseDto)
  companies: CompanyResponseDto[];

  @Expose()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class CompanyUsersResponseDto {
  @Expose()
  @Type(() => UserSummaryDto)
  users: UserSummaryDto[];

  @Expose()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class VendorRegistrationResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  status: CompanyStatus;

  @Expose()
  @Type(() => UserSummaryDto)
  primaryContact: UserSummaryDto;

  @Expose()
  message: string;

  @Expose()
  createdAt: Date;

  // Exclude all other sensitive fields
  @Exclude()
  address: string;

  @Exclude()
  email: string;

  @Exclude()
  phoneNumber: string;

  @Exclude()
  type: CompanyType;

  @Exclude()
  subscriptionType: string;

  @Exclude()
  subscriptionStatus: string;

  @Exclude()
  subdomain: string;

  @Exclude()
  billingPlanId: string;

  @Exclude()
  submittedDocumentsRef: string;

  @Exclude()
  primaryContactUserId: string;

  @Exclude()
  ownerId: string;

  @Exclude()
  updatedAt: Date;
}
