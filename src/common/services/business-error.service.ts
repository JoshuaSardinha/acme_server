import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

export interface BusinessErrorContext {
  operation: string;
  entity: string;
  entityId?: string;
  userId?: string;
  companyId?: string;
  teamId?: string;
  additionalInfo?: Record<string, any>;
}

@Injectable()
export class BusinessErrorService {
  /**
   * Creates a standardized validation error with context
   */
  createValidationError(
    message: string,
    context: BusinessErrorContext,
    originalError?: Error
  ): BadRequestException {
    const errorDetails = {
      message,
      context,
      timestamp: new Date().toISOString(),
      errorType: 'BUSINESS_VALIDATION_ERROR',
      originalError: originalError?.message,
    };

    return new BadRequestException({
      message,
      error: 'Business Validation Failed',
      details: errorDetails,
    });
  }

  /**
   * Creates a standardized not found error with context
   */
  createNotFoundError(
    entity: string,
    entityId: string,
    context: BusinessErrorContext,
    originalError?: Error
  ): NotFoundException {
    const message = `${entity} with ID ${entityId} not found`;
    const errorDetails = {
      message,
      context,
      timestamp: new Date().toISOString(),
      errorType: 'ENTITY_NOT_FOUND',
      originalError: originalError?.message,
    };

    return new NotFoundException({
      message,
      error: 'Entity Not Found',
      details: errorDetails,
    });
  }

  /**
   * Creates a standardized permission error with context
   */
  createPermissionError(
    message: string,
    context: BusinessErrorContext,
    originalError?: Error
  ): ForbiddenException {
    const errorDetails = {
      message,
      context,
      timestamp: new Date().toISOString(),
      errorType: 'PERMISSION_DENIED',
      originalError: originalError?.message,
    };

    return new ForbiddenException({
      message,
      error: 'Permission Denied',
      details: errorDetails,
    });
  }

  /**
   * Creates company-specific validation errors
   */
  createCompanyValidationError(
    type:
      | 'USER_NOT_IN_COMPANY'
      | 'COMPANY_NOT_FOUND'
      | 'CROSS_COMPANY_ACCESS'
      | 'DUPLICATE_TEAM_NAME',
    context: BusinessErrorContext & { companyId: string },
    additionalData?: Record<string, any>
  ): BadRequestException | NotFoundException {
    switch (type) {
      case 'USER_NOT_IN_COMPANY':
        return this.createValidationError(
          `User ${context.userId} does not belong to company ${context.companyId}. ${additionalData?.currentCompany ? `User belongs to company ${additionalData.currentCompany}` : 'User has no company assignment'}`,
          context
        );

      case 'COMPANY_NOT_FOUND':
        return this.createNotFoundError('Company', context.companyId, context);

      case 'CROSS_COMPANY_ACCESS':
        return this.createPermissionError(
          'Access denied: Cannot access data from a different company',
          context
        );

      case 'DUPLICATE_TEAM_NAME':
        return this.createValidationError(
          `A team with the name "${additionalData?.teamName}" already exists in company ${context.companyId}`,
          context
        );

      default:
        return this.createValidationError('Unknown company validation error', context);
    }
  }

  /**
   * Creates team-specific validation errors
   */
  createTeamValidationError(
    type:
      | 'TEAM_NOT_FOUND'
      | 'MANAGER_WRONG_COMPANY'
      | 'MEMBER_WRONG_COMPANY'
      | 'LEGAL_TEAM_NO_LAWYER'
      | 'MANAGER_IN_MEMBERS',
    context: BusinessErrorContext & { teamId: string },
    additionalData?: Record<string, any>
  ): BadRequestException | NotFoundException {
    switch (type) {
      case 'TEAM_NOT_FOUND':
        return this.createNotFoundError('Team', context.teamId, context);

      case 'MANAGER_WRONG_COMPANY':
        return this.createValidationError(
          `Team manager must belong to the same company as the team. Manager belongs to company ${additionalData?.managerCompany || 'none'}, but team is in company ${context.companyId}`,
          context
        );

      case 'MEMBER_WRONG_COMPANY':
        const invalidMembers = additionalData?.invalidMembers || [];
        const memberInfo = invalidMembers
          .map(
            (m: any) =>
              `${m.first_name} ${m.last_name} (${m.id}) belongs to company ${m.company_id || 'none'}`
          )
          .join(', ');
        return this.createValidationError(
          `All team members must belong to the same company as the team. Invalid members: ${memberInfo}`,
          context
        );

      case 'LEGAL_TEAM_NO_LAWYER':
        return this.createValidationError(
          'LEGAL teams must have at least one lawyer as either the manager or a team member',
          context
        );

      case 'MANAGER_IN_MEMBERS':
        return this.createValidationError(
          'Team manager cannot also be listed as a regular team member',
          context
        );

      default:
        return this.createValidationError('Unknown team validation error', context);
    }
  }

  /**
   * Creates membership-specific validation errors
   */
  createMembershipValidationError(
    type:
      | 'USER_ALREADY_MEMBER'
      | 'USER_NOT_MEMBER'
      | 'CANNOT_ADD_MANAGER'
      | 'REMOVE_LAST_LAWYER'
      | 'PERMISSION_DENIED',
    context: BusinessErrorContext & { teamId: string },
    additionalData?: Record<string, any>
  ): BadRequestException | ForbiddenException {
    switch (type) {
      case 'USER_ALREADY_MEMBER':
        return this.createValidationError(
          `User ${additionalData?.userId} is already a member of team ${context.teamId}`,
          context
        );

      case 'USER_NOT_MEMBER':
        const missingUsers = additionalData?.missingUsers || [additionalData?.userId];
        return this.createValidationError(
          `The following users are not members of the team: ${missingUsers.join(', ')}`,
          context
        );

      case 'CANNOT_ADD_MANAGER':
        return this.createValidationError(
          'Team manager cannot be added as a regular team member',
          context
        );

      case 'REMOVE_LAST_LAWYER':
        return this.createValidationError(
          'Cannot remove all lawyers from a LEGAL team. At least one lawyer must remain as either the manager or a team member',
          context
        );

      case 'PERMISSION_DENIED':
        return this.createPermissionError(
          'Insufficient permissions to modify team membership. Only team managers, company owners, or Acme employees can perform this operation.',
          context
        );

      default:
        return this.createValidationError('Unknown membership validation error', context);
    }
  }

  /**
   * Logs business validation errors for monitoring and debugging
   */
  logValidationError(error: Error, context: BusinessErrorContext): void {
    const logData = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      type: 'BUSINESS_VALIDATION_ERROR',
      message: error.message,
      context,
      stack: error.stack,
    };

    // In production, this would integrate with a proper logging service
    console.error('[BUSINESS_VALIDATION_ERROR]', JSON.stringify(logData, null, 2));
  }

  /**
   * Creates a comprehensive error report for debugging
   */
  createErrorReport(
    error: Error,
    context: BusinessErrorContext,
    validationSteps: string[]
  ): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      context,
      validationSteps,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
      },
    };
  }
}
