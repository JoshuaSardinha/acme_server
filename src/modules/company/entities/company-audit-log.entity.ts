import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Company, CompanyStatus } from './company.entity';
import { User } from '../../auth/entities/user.entity';

export enum AuditAction {
  VENDOR_REGISTERED = 'VENDOR_REGISTERED',
  VENDOR_APPROVED = 'VENDOR_APPROVED',
  VENDOR_REJECTED = 'VENDOR_REJECTED',
  VENDOR_SUSPENDED = 'VENDOR_SUSPENDED',
  VENDOR_REACTIVATED = 'VENDOR_REACTIVATED',
  COMPANY_CREATED = 'COMPANY_CREATED',
  COMPANY_UPDATED = 'COMPANY_UPDATED',
  USER_ADDED = 'USER_ADDED',
  USER_REMOVED = 'USER_REMOVED',
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  STATUS_CHANGED = 'STATUS_CHANGED',
}

@Table({
  tableName: 'CompanyAuditLogs',
  timestamps: false, // We manage created_at manually
  underscored: true,
  indexes: [
    {
      fields: ['company_id', 'performed_at'],
      name: 'idx_company_audit_company_date',
    },
    {
      fields: ['performed_by', 'performed_at'],
      name: 'idx_company_audit_user_date',
    },
    {
      fields: ['action', 'performed_at'],
      name: 'idx_company_audit_action_date',
    },
    {
      fields: ['previous_status', 'new_status', 'performed_at'],
      name: 'idx_company_audit_status_transitions',
    },
    {
      fields: ['performed_at'],
      name: 'idx_company_audit_date_range',
    },
  ],
})
export class CompanyAuditLog extends Model<CompanyAuditLog> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Index
  @Column(DataType.UUID)
  company_id: string;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  action: AuditAction;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Index
  @Column(DataType.UUID)
  performed_by: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Index
  @Column(DataType.DATE)
  performed_at: Date;

  @Column({
    type: DataType.ENUM(...Object.values(CompanyStatus)),
    allowNull: true,
  })
  previous_status?: CompanyStatus;

  @Column({
    type: DataType.ENUM(...Object.values(CompanyStatus)),
    allowNull: true,
  })
  new_status?: CompanyStatus;

  @Column(DataType.TEXT)
  reason?: string;

  @Column(DataType.JSON)
  details?: any;

  @Column(DataType.STRING(45)) // Support IPv6
  ip_address?: string;

  @Column(DataType.TEXT)
  user_agent?: string;

  @CreatedAt
  @Column(DataType.DATE)
  created_at: Date;

  // Associations
  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => User, 'performed_by')
  performer: User;
}
