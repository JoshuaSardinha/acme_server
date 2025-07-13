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
import { Permission } from './permission.entity';
import { Role } from './role.entity';

@Table({
  tableName: 'RolePermissions',
  timestamps: true,
  underscored: true,
})
export class RolePermission extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @ForeignKey(() => Role)
  @Column(DataType.UUID)
  role_id: string;

  @AllowNull(false)
  @ForeignKey(() => Permission)
  @Column(DataType.UUID)
  permission_id: string;

  @BelongsTo(() => Role)
  role: Role;

  @BelongsTo(() => Permission)
  permission: Permission;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;
}
