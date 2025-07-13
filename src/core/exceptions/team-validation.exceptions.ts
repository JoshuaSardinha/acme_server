import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Team Validation Error Codes matching Express teamValidatorCodes.js
 * These exceptions maintain exact compatibility with Express middleware responses
 */
export class TeamValidationCodes {
  static readonly USER_ID_NOT_IN_BODY = {
    code: 'USER_ID_NOT_IN_BODY',
    message: 'User ID not in body',
  };
  static readonly USER_NOT_FOUND = { code: 'USER_NOT_FOUND', message: 'User not found' };
  static readonly USER_IS_IN_A_COMPANY = {
    code: 'USER_IS_IN_A_COMPANY',
    message: 'User already belongs to a company',
  };
  static readonly USER_IS_NOT_IN_THIS_TEAM = {
    code: 'USER_IS_NOT_IN_THIS_TEAM',
    message: 'User does not belong to this team',
  };
  static readonly TEAM_DOES_NOT_BELONG_TO_COMPANY = {
    code: 'TEAM_DOES_NOT_BELONG_TO_COMPANY',
    message: 'Team does not belong to company',
  };
  static readonly USER_IS_NOT_ADMIN_OR_MANAGER = {
    code: 'USER_IS_NOT_ADMIN_OR_MANAGER',
    message: 'User is not admin or manager of company',
  };
  static readonly USER_TO_BE_ADDED_DOES_NOT_EXIST = {
    code: 'USER_TO_BE_ADDED_DOES_NOT_EXIST',
    message: 'Provided ID for user to be added does not exist',
  };
  static readonly USER_TO_BE_ADDED_DOES_NOT_BELONG_TO_COMPANY = {
    code: 'USER_TO_BE_ADDED_DOES_NOT_BELONG_TO_COMPANY',
    message: 'User to be added does not belong to company',
  };
  static readonly USER_IS_ALREADY_IN_TEAM = {
    code: 'USER_IS_ALREADY_IN_TEAM',
    message: 'User to be added is already in the team',
  };
  static readonly USER_TO_BE_REMOVED_DOES_NOT_EXIST = {
    code: 'USER_TO_BE_REMOVED_DOES_NOT_EXIST',
    message: 'Provided ID for user to be removed does not exist',
  };
  static readonly USER_TO_BE_REMOVED_DOES_NOT_BELONG_TO_COMPANY = {
    code: 'USER_TO_BE_REMOVED_DOES_NOT_BELONG_TO_COMPANY',
    message: 'User to be removed does not belong to company',
  };
  static readonly TEAM_NOT_FOUND = { code: 'TEAM_NOT_FOUND', message: 'Team not found' };
  static readonly USER_NOT_ADMIN = {
    code: 'USER_NOT_ADMIN',
    message: 'User is not admin of company',
  };
  static readonly USER_NOT_FROM_COMPANY = {
    code: 'USER_NOT_FROM_COMPANY',
    message: 'User is not from company',
  };
  static readonly USER_IS_NOT_TEAM_MANAGER_OR_ADMIN = {
    code: 'USER_IS_NOT_TEAM_MANAGER_OR_ADMIN',
    message: 'User must be team manager or company admin to delete team',
  };
  static readonly INVALID_USER_IDS = {
    code: 'INVALID_USER_IDS',
    message: 'User IDs must be a non-empty array',
  };
}

/**
 * Base class for team validation exceptions that maintain Express compatibility
 */
export class TeamValidationException extends HttpException {
  constructor(errorCode: { code: string; message: string }, status: HttpStatus) {
    super(
      {
        success: false,
        ...errorCode,
      },
      status
    );
  }
}

// Specific exception classes for each validation error
export class TeamDoesNotBelongToCompanyException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.TEAM_DOES_NOT_BELONG_TO_COMPANY, HttpStatus.FORBIDDEN);
  }
}

export class UserIsNotInThisTeamException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_IS_NOT_IN_THIS_TEAM, HttpStatus.FORBIDDEN);
  }
}

export class UserIsNotAdminOrManagerException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_IS_NOT_ADMIN_OR_MANAGER, HttpStatus.FORBIDDEN);
  }
}

export class UserToBeAddedDoesNotExistException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_TO_BE_ADDED_DOES_NOT_EXIST, HttpStatus.FORBIDDEN);
  }
}

export class UserToBeAddedDoesNotBelongToCompanyException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_TO_BE_ADDED_DOES_NOT_BELONG_TO_COMPANY, HttpStatus.FORBIDDEN);
  }
}

export class UserIsAlreadyInTeamException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_IS_ALREADY_IN_TEAM, HttpStatus.FORBIDDEN);
  }
}

export class UserToBeRemovedDoesNotExistException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_TO_BE_REMOVED_DOES_NOT_EXIST, HttpStatus.FORBIDDEN);
  }
}

export class UserToBeRemovedDoesNotBelongToCompanyException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_TO_BE_REMOVED_DOES_NOT_BELONG_TO_COMPANY, HttpStatus.FORBIDDEN);
  }
}

export class TeamNotFoundException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.TEAM_NOT_FOUND, HttpStatus.NOT_FOUND);
  }
}

export class UserNotAdminException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_NOT_ADMIN, HttpStatus.FORBIDDEN);
  }
}

export class UserNotFromCompanyException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_NOT_FROM_COMPANY, HttpStatus.FORBIDDEN);
  }
}

export class UserIsNotTeamManagerOrAdminException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_IS_NOT_TEAM_MANAGER_OR_ADMIN, HttpStatus.FORBIDDEN);
  }
}

export class UserNotFoundValidationException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
  }
}

export class InvalidUserIdsException extends TeamValidationException {
  constructor() {
    super(TeamValidationCodes.INVALID_USER_IDS, HttpStatus.BAD_REQUEST);
  }
}
