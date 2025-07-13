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
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../auth/entities/user.entity';
import { Company } from '../../company/entities/company.entity';
import { TeamMember } from './team-member.entity';

// Team Category Enum per REQ-TEAM-001
export enum TeamCategory {
  LEGAL = 'LEGAL',
  CONVENTIONAL = 'CONVENTIONAL',
}

@Table({
  tableName: 'Teams',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['company_id'],
    },
    {
      fields: ['owner_user_id'],
    },
    {
      fields: ['category'],
    },
    {
      fields: ['is_active'],
    },
    {
      fields: ['company_id', 'name'],
      unique: true,
    },
  ],
})
export class Team extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  name: string;

  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column(DataType.UUID)
  company_id: string;

  @Column(DataType.TEXT)
  description: string;

  @Column({
    type: DataType.ENUM(...Object.values(TeamCategory)),
    allowNull: false,
    defaultValue: TeamCategory.CONVENTIONAL,
  })
  category: TeamCategory;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  is_active: boolean;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  owner_user_id: string;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => require('../../auth/entities/user.entity').User, 'owner_user_id')
  owner: User;

  @HasMany(() => require('./team-member.entity').TeamMember, 'team_id')
  teamMembers: TeamMember[];

  @BelongsToMany(() => require('../../auth/entities/user.entity').User, {
    through: () => require('./team-member.entity').TeamMember,
    as: 'members',
  })
  members: User[];

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;
}
