import { ValidationOptions, ValidationArguments, IsIn } from 'class-validator';
import { ACME_ROLES } from '../../modules/auth/constants/acme-roles';

export function IsAcmeRole(validationOptions?: ValidationOptions) {
  return IsIn(ACME_ROLES, {
    message: (args: ValidationArguments) =>
      `Role '${args.value}' is not a valid Acme role. Must be one of: ${ACME_ROLES.join(', ')}.`,
    ...validationOptions,
  });
}
