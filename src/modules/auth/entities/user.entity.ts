import {
  AllowNull,
  BelongsTo,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { Company } from '../../company/entities/company.entity';
import { Permission } from '../../role/entities/permission.entity';
import { Role } from '../../role/entities/role.entity';
import { UserPermission } from '../../role/entities/user-permission.entity';
import { TeamMember } from '../../team/entities/team-member.entity';
import { Team } from '../../team/entities/team.entity';

// Keep enum for backward compatibility and type checking
// Note: This enum is now only used for reference - actual role data comes from Role entity
export enum UserRole {
  CLIENT = 'client',
  VENDOR_EMPLOYEE = 'vendor_employee',
  VENDOR_ADMIN = 'vendor_admin',
  ACME_EMPLOYEE = 'acme_employee',
  ACME_ADMIN = 'acme_admin',
  VENDOR_MANAGER = 'vendor_manager',
  ACME_MANAGER = 'acme_manager',
  TEAM_MEMBER = 'team_member', // Added for test compatibility
  SUPER_ADMIN = 'super_admin', // Ultimate system administrator with all permissions
}

/**
 * User account status lifecycle enum.
 * Tracks the current state of a user's account.
 */
export enum UserStatus {
  /** User account is newly created and awaiting activation */
  PENDING = 'pending',
  /** User account is active and can access the system */
  ACTIVE = 'active',
  /** User account is temporarily suspended (can be reactivated) */
  SUSPENDED = 'suspended',
  /** User account is permanently deactivated */
  DEACTIVATED = 'deactivated',
}

@Table({
  tableName: 'Users',
  timestamps: true,
  underscored: true,
})
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  first_name: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  last_name: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  email: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  auth0_user_id: string;

  @AllowNull(false)
  @ForeignKey(() => Role)
  @Column(DataType.UUID)
  role_id: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  is_lawyer: boolean;

  @AllowNull(false)
  @Default(UserStatus.PENDING)
  @Column(DataType.ENUM(...Object.values(UserStatus)))
  status: UserStatus;

  @ForeignKey(() => Company)
  @Column(DataType.UUID)
  company_id: string;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => Role)
  role: Role;

  /**
   * Defines the one-to-many relationship where a User can manage multiple teams.
   * The foreign key 'owner_user_id' is defined in the Team entity.
   */
  @HasMany(() => Team, {
    foreignKey: 'owner_user_id',
    as: 'managed_teams',
  })
  managed_teams: Team[];

  /**
   * Defines the many-to-many relationship where a User can be a member of multiple teams.
   * This relationship is linked through the 'TeamMember' join table.
   */
  @BelongsToMany(() => Team, {
    through: () => TeamMember,
    as: 'teams',
  })
  teams: Team[];

  @BelongsToMany(() => Permission, () => UserPermission)
  permissions: Permission[];

  @HasMany(() => UserPermission)
  user_permissions: UserPermission[];

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;

  // Helper methods for role checking
  hasRole(roleName: string): boolean {
    return this.role?.name === roleName;
  }

  hasRoleEnum(roleEnum: UserRole): boolean {
    if (!this.role) return false;

    // Map role codes to enum values
    const roleMapping: Record<string, UserRole> = {
      client: UserRole.CLIENT,
      vendor_employee: UserRole.VENDOR_EMPLOYEE,
      vendor_admin: UserRole.VENDOR_ADMIN,
      acme_employee: UserRole.ACME_EMPLOYEE,
      acme_admin: UserRole.ACME_ADMIN,
      vendor_manager: UserRole.VENDOR_MANAGER,
      acme_manager: UserRole.ACME_MANAGER,
      team_member: UserRole.TEAM_MEMBER,
      super_admin: UserRole.SUPER_ADMIN,
    };

    return roleMapping[this.role.code] === roleEnum;
  }

  get roleEnum(): UserRole | null {
    if (!this.role) return null;

    const roleMapping: Record<string, UserRole> = {
      client: UserRole.CLIENT,
      vendor_employee: UserRole.VENDOR_EMPLOYEE,
      vendor_admin: UserRole.VENDOR_ADMIN,
      acme_employee: UserRole.ACME_EMPLOYEE,
      acme_admin: UserRole.ACME_ADMIN,
      vendor_manager: UserRole.VENDOR_MANAGER,
      acme_manager: UserRole.ACME_MANAGER,
      team_member: UserRole.TEAM_MEMBER,
      super_admin: UserRole.SUPER_ADMIN,
    };

    return roleMapping[this.role.code] || null;
  }
}
