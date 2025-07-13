import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../auth/entities/user.entity';
import { Permission } from './permission.entity';

@Table({
  tableName: 'UserPermissions',
  timestamps: true,
  underscored: true,
})
export class UserPermission extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  user_id: string;

  @AllowNull(false)
  @ForeignKey(() => Permission)
  @Column(DataType.UUID)
  permission_id: string;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  granted: boolean;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  granted_by: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  granted_at: Date;

  @BelongsTo(() => User, 'user_id')
  user: User;

  @BelongsTo(() => Permission)
  permission: Permission;

  @BelongsTo(() => User, 'granted_by')
  granter: User;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;
}
