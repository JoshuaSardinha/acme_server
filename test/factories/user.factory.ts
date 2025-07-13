import { User, UserRole } from '../../src/modules/auth/entities/user.entity';
import { getRoleIdByCode } from './role.factory';

let userCounter = 1;

export interface CreateUserOptions {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  role_id?: string;
  company_id?: string;
  auth0_user_id?: string;
  is_lawyer?: boolean;
}

export const createTestUser = async (
  companyId?: string,
  options: CreateUserOptions = {}
): Promise<User> => {
  const userNum = userCounter++;

  // Get role_id if role is provided but role_id is not
  let roleId: string | undefined = options.role_id;
  if (!roleId && options.role) {
    // Map UserRole enum to role code
    const roleCode = options.role.replace(/_/g, '_');
    const foundRoleId = await getRoleIdByCode(roleCode);
    if (!foundRoleId) {
      throw new Error(`Role not found for code: ${roleCode}`);
    }
    roleId = foundRoleId;
  } else if (!roleId) {
    // Default to client role
    const foundRoleId = await getRoleIdByCode('client');
    if (!foundRoleId) {
      throw new Error('Client role not found in database');
    }
    roleId = foundRoleId;
  }

  const defaults = {
    email: `testuser${userNum}@example.com`,
    first_name: `Test`,
    last_name: `User${userNum}`,
    role_id: roleId,
    company_id: companyId,
    auth0_user_id: `auth0|test_user_${userNum}`,
    is_lawyer: false,
  };

  const userData: any = { ...defaults, ...options, company_id: companyId, role_id: roleId };

  // Remove the role field as it's not part of the User entity anymore
  delete userData.role;

  try {
    return await User.create(userData);
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
};

export const createTestUserWithRole = async (
  companyId: string,
  role: UserRole,
  options: CreateUserOptions = {}
): Promise<User> => {
  return createTestUser(companyId, { ...options, role });
};

export const createTestVendorAdmin = async (
  companyId: string,
  options: CreateUserOptions = {}
): Promise<User> => {
  return createTestUserWithRole(companyId, UserRole.VENDOR_ADMIN, options);
};

export const createTestCompanyAdmin = async (
  companyId: string,
  options: CreateUserOptions = {}
): Promise<User> => {
  return createTestUserWithRole(companyId, UserRole.VENDOR_ADMIN, options);
};

export const createTestUsers = async (
  companyId: string,
  count: number,
  options: CreateUserOptions = {}
): Promise<User[]> => {
  const users: User[] = [];

  for (let i = 0; i < count; i++) {
    const user = await createTestUser(companyId, options);
    users.push(user);
  }

  return users;
};
