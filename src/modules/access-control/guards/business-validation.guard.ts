import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyValidationService } from '../../company/services/company-validation.service';
import { TeamValidationService } from '../../team/services/team-validation.service';
import { MembershipValidationService } from '../../team/services/membership-validation.service';

export interface BusinessValidationConfig {
  validateCompanyAccess?: boolean;
  validateTeamAccess?: boolean;
  validateTeamMembership?: boolean;
  requireSameCompany?: boolean;
}

export const BUSINESS_VALIDATION_KEY = 'business-validation';

/**
 * Decorator to configure business validation rules for endpoints
 */
export const BusinessValidation = (config: BusinessValidationConfig) => {
  return SetMetadata(BUSINESS_VALIDATION_KEY, config);
};

@Injectable()
export class BusinessValidationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private companyValidationService: CompanyValidationService,
    private teamValidationService: TeamValidationService,
    private membershipValidationService: MembershipValidationService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<BusinessValidationConfig>(
      BUSINESS_VALIDATION_KEY,
      context.getHandler()
    );

    if (!config) {
      return true; // No validation configured
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const params = request.params;
    const body = request.body;

    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    try {
      // Validate company access
      if (config.validateCompanyAccess && params.companyId) {
        await this.companyValidationService.validateCrossCompanyAccess(user.id, params.companyId);
      }

      // Validate team access
      if (config.validateTeamAccess && params.teamId) {
        if (params.companyId) {
          await this.teamValidationService.validateTeamExistsInCompany(
            params.teamId,
            params.companyId
          );
        }
      }

      // Validate team membership operations
      if (config.validateTeamMembership && params.teamId) {
        const operation = this.determineOperationType(request.method, request.route?.path);
        if (operation) {
          await this.membershipValidationService.validateMembershipOperationPermissions(
            user.id,
            params.teamId,
            operation
          );
        }
      }

      // Validate same company requirement
      if (config.requireSameCompany) {
        await this.validateSameCompanyRequirement(user, params, body);
      }

      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Business validation failed: ${error.message}`);
    }
  }

  private determineOperationType(
    method: string,
    path?: string
  ): 'add' | 'remove' | 'replace' | null {
    if (method === 'POST' && path?.includes('members')) {
      return 'add';
    }
    if (method === 'DELETE' && path?.includes('members')) {
      return 'remove';
    }
    if (method === 'PUT' && path?.includes('members')) {
      return 'replace';
    }
    return null;
  }

  private async validateSameCompanyRequirement(user: any, params: any, body: any): Promise<void> {
    const companyId = params.companyId || body.companyId;
    if (companyId) {
      await this.companyValidationService.validateUserBelongsToCompany(user.id, companyId);
    }
  }
}
