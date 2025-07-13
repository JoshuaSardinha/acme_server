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
import { Team } from './team.entity';

@Table({
  tableName: 'TeamMembers',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['team_id'],
    },
    {
      fields: ['user_id'],
    },
    {
      fields: ['added_by_user_id'],
    },
    {
      fields: ['added_at'],
    },
    {
      unique: true,
      fields: ['team_id', 'user_id'],
    },
  ],
})
export class TeamMember extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  team_id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  user_id: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  added_at: Date;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  added_by_user_id: string;

  @BelongsTo(() => Team, 'team_id')
  team: Team;

  @BelongsTo(() => User, 'user_id')
  user: User;

  @BelongsTo(() => User, 'added_by_user_id')
  addedBy: User;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;
}
