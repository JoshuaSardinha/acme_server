import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Company } from '../../modules/company/entities/company.entity';
import { UserRole } from '../../modules/auth/entities/user.entity';

@Injectable()
export class CompanyAdminGuard implements CanActivate {
  constructor(
    @InjectModel(Company)
    private companyModel: typeof Company
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is admin
    const isAdmin = [UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role);
    if (!isAdmin) {
      throw new ForbiddenException('User is not an admin');
    }

    // For endpoints with id parameter (company ID), validate access to that specific company
    const { id: companyId } = request.params;
    if (companyId) {
      const company = await this.companyModel.findByPk(companyId);
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      // Check if user belongs to the company
      if (user.company_id !== company.id) {
        throw new ForbiddenException('User not authorized to access this company');
      }

      // Attach company to request for use in controllers
      request.company = company;
    } else {
      // For endpoints without companyId, ensure user has a company
      if (!user.company_id) {
        throw new ForbiddenException('User does not belong to a company');
      }

      const company = await this.companyModel.findByPk(user.company_id);
      if (!company) {
        throw new NotFoundException('User company not found');
      }

      request.company = company;
    }

    return true;
  }
}
