import { Role } from '../../src/modules/role/entities/role.entity';
import { QueryTypes } from 'sequelize';

export interface RoleData {
  name: string;
  code?: string;
  description: string;
}

// Standard roles that match the migration
export const STANDARD_ROLES: RoleData[] = [
  {
    name: 'Super Admin',
    code: 'super_admin',
    description: 'Ultimate system administrator with all permissions',
  },
  { name: 'Client', code: 'client', description: 'Client company user' },
  {
    name: 'National Niner Admin',
    code: 'national_niner_admin',
    description: 'National Niner administrator',
  },
  {
    name: 'National Niner Manager',
    code: 'national_niner_manager',
    description: 'National Niner manager',
  },
  {
    name: 'National Niner Employee',
    code: 'national_niner_employee',
    description: 'National Niner employee',
  },
  { name: 'Vendor Admin', code: 'vendor_admin', description: 'Vendor company administrator' },
  { name: 'Vendor Manager', code: 'vendor_manager', description: 'Vendor company manager' },
  { name: 'Vendor Employee', code: 'vendor_employee', description: 'Vendor company employee' },
];

export const createTestRole = async (roleData: Partial<RoleData>): Promise<Role> => {
  const defaultData = {
    name: 'Test Role',
    code: 'test_role',
    description: 'Test role description',
  };

  const finalData = { ...defaultData, ...roleData };

  try {
    return await Role.create(finalData as any);
  } catch (error) {
    console.error('Error creating test role:', error);
    throw error;
  }
};

export const createStandardRoles = async (): Promise<Role[]> => {
  const roles: Role[] = [];
  const sequelize = Role.sequelize;

  if (!sequelize) {
    throw new Error('Sequelize instance not available');
  }

  for (const roleData of STANDARD_ROLES) {
    try {
      // Use raw query to check if role exists
      const existingRoles = (await sequelize.query(
        'SELECT id, name FROM Roles WHERE name = :name',
        {
          replacements: { name: roleData.name },
          type: QueryTypes.SELECT,
        }
      )) as any[];

      let roleId: string;

      if (existingRoles && existingRoles.length > 0) {
        roleId = existingRoles[0].id;
      } else {
        // Create role using raw query
        const uuid = require('crypto').randomUUID();

        // Check if code column exists by checking table schema
        const columns = (await sequelize.query("SHOW COLUMNS FROM Roles LIKE 'code'", {
          type: QueryTypes.SELECT,
        })) as any[];

        if (columns && columns.length > 0) {
          // Code column exists
          await sequelize.query(
            'INSERT INTO Roles (id, name, code, description, created_at, updated_at) VALUES (:id, :name, :code, :description, NOW(), NOW())',
            {
              replacements: {
                id: uuid,
                name: roleData.name,
                code: roleData.code,
                description: roleData.description,
              },
            }
          );
        } else {
          // Code column doesn't exist
          await sequelize.query(
            'INSERT INTO Roles (id, name, description, created_at, updated_at) VALUES (:id, :name, :description, NOW(), NOW())',
            {
              replacements: {
                id: uuid,
                name: roleData.name,
                description: roleData.description,
              },
            }
          );
        }

        roleId = uuid;
      }

      // Fetch the created role using raw query to avoid model attribute issues
      const createdRoles = (await sequelize.query('SELECT * FROM Roles WHERE id = :id', {
        replacements: { id: roleId },
        type: QueryTypes.SELECT,
      })) as any[];

      if (createdRoles && createdRoles.length > 0) {
        // Create a partial Role instance
        const role = Role.build(createdRoles[0] as any, { isNewRecord: false });
        roles.push(role);
      }
    } catch (error) {
      console.error(`Error creating role ${roleData.name}:`, error);
      // Continue with other roles even if one fails
    }
  }

  return roles;
};

export const getRoleByCode = async (code: string): Promise<Role | null> => {
  const sequelize = Role.sequelize;

  if (!sequelize) {
    throw new Error('Sequelize instance not available');
  }

  const nameMapping: Record<string, string> = {
    super_admin: 'Super Admin',
    client: 'Client',
    national_niner_admin: 'National Niner Admin',
    national_niner_manager: 'National Niner Manager',
    national_niner_employee: 'National Niner Employee',
    vendor_admin: 'Vendor Admin',
    vendor_manager: 'Vendor Manager',
    vendor_employee: 'Vendor Employee',
  };

  const roleName = nameMapping[code];
  if (!roleName) return null;

  try {
    // Check if code column exists
    const columns = (await sequelize.query("SHOW COLUMNS FROM Roles LIKE 'code'", {
      type: QueryTypes.SELECT,
    })) as any[];

    let query: string;
    let replacements: any;

    if (columns && columns.length > 0) {
      // Code column exists - try both code and name
      query = 'SELECT * FROM Roles WHERE code = :code OR name = :name LIMIT 1';
      replacements = { code, name: roleName };
    } else {
      // Code column doesn't exist - use name only
      query = 'SELECT * FROM Roles WHERE name = :name LIMIT 1';
      replacements = { name: roleName };
    }

    const roles = (await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    })) as any[];

    if (roles && roles.length > 0) {
      return Role.build(roles[0] as any, { isNewRecord: false });
    }

    return null;
  } catch (error) {
    console.error(`Error finding role by code ${code}:`, error);
    return null;
  }
};

export const getRoleIdByCode = async (code: string): Promise<string | null> => {
  const role = await getRoleByCode(code);
  return role ? role.id : null;
};
