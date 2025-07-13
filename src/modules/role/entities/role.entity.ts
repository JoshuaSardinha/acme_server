import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../auth/entities/user.entity';
import { Permission } from './permission.entity';
import { RolePermission } from './role-permission.entity';
import { UserRole } from './user-role.entity';

@Table({
  tableName: 'Roles',
  timestamps: true,
  underscored: true,
})
export class Role extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  name: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(50))
  code: string;

  @Column(DataType.TEXT)
  description: string;

  @BelongsToMany(() => Permission, () => RolePermission)
  permissions: Permission[];

  @BelongsToMany(() => User, () => UserRole)
  users: User[];

  @HasMany(() => RolePermission)
  role_permissions: RolePermission[];

  @HasMany(() => UserRole)
  user_roles: UserRole[];

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;
}
