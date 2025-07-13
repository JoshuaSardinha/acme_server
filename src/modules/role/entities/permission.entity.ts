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
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../auth/entities/user.entity';
import { RolePermission } from './role-permission.entity';
import { Role } from './role.entity';
import { UserPermission } from './user-permission.entity';

@Table({
  tableName: 'Permissions',
  timestamps: true,
  underscored: true,
})
export class Permission extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  name: string;

  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.STRING)
  category: string;

  @BelongsToMany(() => Role, () => RolePermission)
  roles: Role[];

  @BelongsToMany(() => User, () => UserPermission)
  users: User[];

  @HasMany(() => RolePermission)
  role_permissions: RolePermission[];

  @HasMany(() => UserPermission)
  user_permissions: UserPermission[];

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;
}
