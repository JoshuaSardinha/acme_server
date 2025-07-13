import {
  AllowNull,
  BelongsTo,
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
import { Team } from '../../team/entities/team.entity';

// Company Type Enum per REQ-COMP-001
export enum CompanyType {
  ACME = 'ACME',
  VENDOR = 'VENDOR',
}

// Company Status Enum per REQ-COMP-001
export enum CompanyStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

@Table({
  tableName: 'Companies',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      name: 'idx_companies_owner_id',
      fields: ['owner_id'],
    },
    {
      name: 'idx_companies_primary_contact_user_id',
      fields: ['primary_contact_user_id'],
    },
    {
      name: 'idx_companies_type_status',
      fields: ['type', 'status'],
    },
    {
      name: 'idx_companies_billing_plan_id',
      fields: ['billing_plan_id'],
    },
    {
      name: 'idx_companies_created_at',
      fields: ['created_at'],
    },
    {
      name: 'unique_company_name',
      unique: true,
      fields: ['name'],
    },
    {
      name: 'unique_company_subdomain',
      unique: true,
      fields: ['subdomain'],
    },
  ],
})
export class Company extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  name: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  address: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  email: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  phone_number: string;

  @Column({
    type: DataType.ENUM(...Object.values(CompanyType)),
    allowNull: false,
    defaultValue: CompanyType.VENDOR,
  })
  type: CompanyType;

  @Column({
    type: DataType.ENUM(...Object.values(CompanyStatus)),
    allowNull: false,
    defaultValue: CompanyStatus.PENDING_APPROVAL,
  })
  status: CompanyStatus;

  @AllowNull(true)
  @Column(DataType.STRING)
  subscription_type: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  subscription_status: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  subdomain: string;

  @AllowNull(true)
  @Column(DataType.UUID)
  billing_plan_id: string;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column(DataType.UUID)
  primary_contact_user_id: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  submitted_documents_ref: string;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column(DataType.UUID)
  owner_id: string;

  @BelongsTo(() => User, 'owner_id')
  owner: User;

  @BelongsTo(() => User, 'primary_contact_user_id')
  primaryContact: User;

  @HasMany(() => User, 'company_id')
  users: User[];

  /**
   * Defines the one-to-many relationship where a Company has multiple teams.
   * The foreign key 'company_id' is defined in the Team entity.
   */
  @HasMany(() => Team, 'company_id')
  teams: Team[];

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;
}
