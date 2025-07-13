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
import { Role } from './role.entity';

@Table({
  tableName: 'UserRoles',
  timestamps: true,
  underscored: true,
})
export class UserRole extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  user_id: string;

  @AllowNull(false)
  @ForeignKey(() => Role)
  @Column(DataType.UUID)
  role_id: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  granted_by: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  granted_at: Date;

  @BelongsTo(() => User, { foreignKey: 'user_id', as: 'user' })
  user: User;

  @BelongsTo(() => Role, { foreignKey: 'role_id', as: 'role' })
  role: Role;

  @BelongsTo(() => User, { foreignKey: 'granted_by', as: 'granter' })
  granter: User;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;
}
