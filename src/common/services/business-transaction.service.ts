import { Injectable, BadRequestException } from '@nestjs/common';
import { Sequelize, Transaction } from 'sequelize';
import { InjectConnection } from '@nestjs/sequelize';
import { TeamMember } from '../../modules/team/entities/team-member.entity';

export interface TransactionOperation {
  name: string;
  operation: (transaction: Transaction) => Promise<any>;
  rollbackCondition?: (result: any) => boolean;
  successMessage?: string;
}

export interface TransactionResult<T = any> {
  success: boolean;
  results: T[];
  errors: Error[];
  executedOperations: string[];
  rollbackOperations: string[];
}

@Injectable()
export class BusinessTransactionService {
  constructor(
    @InjectConnection()
    private sequelize: Sequelize
  ) {}

  /**
   * Executes multiple operations in a single transaction with rollback support
   */
  async executeBusinessTransaction<T = any>(
    operations: TransactionOperation[],
    isolationLevel: Transaction.ISOLATION_LEVELS = Transaction.ISOLATION_LEVELS.READ_COMMITTED
  ): Promise<TransactionResult<T>> {
    const result: TransactionResult<T> = {
      success: false,
      results: [],
      errors: [],
      executedOperations: [],
      rollbackOperations: [],
    };

    const transaction = await this.sequelize.transaction({ isolationLevel });

    try {
      for (const op of operations) {
        try {
          console.log(`[TRANSACTION] Executing operation: ${op.name}`);
          const opResult = await op.operation(transaction);

          // Check if this operation should trigger a rollback
          if (op.rollbackCondition && op.rollbackCondition(opResult)) {
            throw new BadRequestException(`Operation ${op.name} triggered rollback condition`);
          }

          result.results.push(opResult);
          result.executedOperations.push(op.name);

          if (op.successMessage) {
            console.log(`[TRANSACTION] ${op.successMessage}`);
          }
        } catch (error) {
          console.error(`[TRANSACTION] Error in operation ${op.name}:`, error);
          result.errors.push(error);
          throw error; // Re-throw to trigger transaction rollback
        }
      }

      await transaction.commit();
      result.success = true;
      console.log(`[TRANSACTION] Successfully completed ${operations.length} operations`);
    } catch (error) {
      console.error('[TRANSACTION] Rolling back due to error:', error);
      await transaction.rollback();

      // Track which operations were attempted
      result.rollbackOperations = result.executedOperations;
      result.executedOperations = [];

      if (!result.errors.includes(error)) {
        result.errors.push(error);
      }
    }

    return result;
  }

  /**
   * Creates a team with full validation and member assignment in a single transaction
   */
  async createTeamWithMembers(
    teamData: {
      name: string;
      companyId: string;
      ownerId: string;
      memberIds: string[];
      category?: string;
    },
    validationServices: {
      teamValidation: any;
      membershipValidation: any;
    }
  ): Promise<TransactionResult> {
    const operations: TransactionOperation[] = [
      {
        name: 'validate-team-creation',
        operation: async () => {
          await validationServices.teamValidation.validateTeamCreation(
            teamData.name,
            teamData.companyId,
            teamData.ownerId,
            teamData.memberIds,
            teamData.category
          );
          return { validated: true };
        },
        successMessage: 'Team creation validation passed',
      },
      {
        name: 'create-team',
        operation: async (transaction) => {
          // This would need to be injected or passed in
          const team = await this.sequelize.models.Team.create(
            {
              name: teamData.name,
              company_id: teamData.companyId,
              manager_id: teamData.ownerId,
            },
            { transaction }
          );
          return team;
        },
        successMessage: 'Team created successfully',
      },
      {
        name: 'validate-member-assignments',
        operation: async () => {
          await validationServices.membershipValidation.validateUsersCanJoinTeam(
            teamData.memberIds,
            'TEMP_TEAM_ID' // This would be the actual team ID from previous operation
          );
          return { membersValidated: true };
        },
        successMessage: 'Member assignments validation passed',
      },
      {
        name: 'create-team-members',
        operation: async (transaction) => {
          const members: TeamMember[] = [];
          for (const userId of teamData.memberIds) {
            const member = await this.sequelize.models.TeamMember.create(
              {
                team_id: 'TEMP_TEAM_ID', // This would be the actual team ID
                user_id: userId,
              },
              { transaction }
            );
            members.push(member as TeamMember);
          }
          return members;
        },
        successMessage: 'Team members assigned successfully',
      },
    ];

    return this.executeBusinessTransaction(operations);
  }

  /**
   * Updates team membership with full validation in a single transaction
   */
  async updateTeamMembership(
    teamId: string,
    membershipChange: {
      add?: string[];
      remove?: string[];
      replace?: string[];
    },
    validationServices: {
      membershipValidation: any;
    }
  ): Promise<TransactionResult> {
    const operations: TransactionOperation[] = [
      {
        name: 'validate-membership-changes',
        operation: async () => {
          await validationServices.membershipValidation.validateBulkMembershipOperation(
            teamId,
            membershipChange
          );
          return { validated: true };
        },
        successMessage: 'Membership changes validation passed',
      },
    ];

    // Add specific operations based on the type of change
    if (membershipChange.replace) {
      operations.push({
        name: 'replace-all-members',
        operation: async (transaction) => {
          // Remove all existing members
          await this.sequelize.models.TeamMember.destroy({
            where: { team_id: teamId },
            transaction,
          });

          // Add new members
          const newMembers: TeamMember[] = [];
          for (const userId of membershipChange.replace!) {
            const member = await this.sequelize.models.TeamMember.create(
              {
                team_id: teamId,
                user_id: userId,
              },
              { transaction }
            );
            newMembers.push(member as TeamMember);
          }
          return newMembers;
        },
        successMessage: 'Team membership replaced successfully',
      });
    } else {
      // Handle add/remove operations
      if (membershipChange.remove && membershipChange.remove.length > 0) {
        operations.push({
          name: 'remove-members',
          operation: async (transaction) => {
            const removedCount = await this.sequelize.models.TeamMember.destroy({
              where: {
                team_id: teamId,
                user_id: membershipChange.remove,
              },
              transaction,
            });
            return { removedCount };
          },
          successMessage: `Removed ${membershipChange.remove.length} members from team`,
        });
      }

      if (membershipChange.add && membershipChange.add.length > 0) {
        operations.push({
          name: 'add-members',
          operation: async (transaction) => {
            const newMembers: TeamMember[] = [];
            for (const userId of membershipChange.add!) {
              const member = await this.sequelize.models.TeamMember.create(
                {
                  team_id: teamId,
                  user_id: userId,
                },
                { transaction }
              );
              newMembers.push(member as TeamMember);
            }
            return newMembers;
          },
          successMessage: `Added ${membershipChange.add.length} members to team`,
        });
      }
    }

    return this.executeBusinessTransaction(operations);
  }

  /**
   * Changes team manager with validation and membership cleanup in a single transaction
   */
  async changeTeamManager(
    teamId: string,
    newManagerId: string,
    validationServices: {
      teamValidation: any;
    }
  ): Promise<TransactionResult> {
    const operations: TransactionOperation[] = [
      {
        name: 'validate-manager-change',
        operation: async () => {
          await validationServices.teamValidation.validateManagerChange(teamId, newManagerId);
          return { validated: true };
        },
        successMessage: 'Manager change validation passed',
      },
      {
        name: 'remove-manager-from-members',
        operation: async (transaction) => {
          const removedCount = await this.sequelize.models.TeamMember.destroy({
            where: {
              team_id: teamId,
              user_id: newManagerId,
            },
            transaction,
          });
          return { removedFromMembers: removedCount > 0 };
        },
        successMessage: 'Removed new manager from regular members list',
      },
      {
        name: 'update-team-manager',
        operation: async (transaction) => {
          const [updatedRows] = await this.sequelize.models.Team.update(
            { manager_id: newManagerId },
            {
              where: { id: teamId },
              transaction,
            }
          );
          return { updatedRows };
        },
        rollbackCondition: (result) => result.updatedRows === 0,
        successMessage: 'Team manager updated successfully',
      },
    ];

    return this.executeBusinessTransaction(operations);
  }

  /**
   * Executes a safe deletion operation with dependency checks
   */
  async safeDelete(
    entityType: string,
    entityId: string,
    dependencyChecks: TransactionOperation[],
    deleteOperation: TransactionOperation
  ): Promise<TransactionResult> {
    const operations: TransactionOperation[] = [...dependencyChecks, deleteOperation];

    return this.executeBusinessTransaction(operations, Transaction.ISOLATION_LEVELS.SERIALIZABLE);
  }

  /**
   * Logs transaction results for monitoring and debugging
   */
  logTransactionResult(result: TransactionResult, operationName: string): void {
    const logData = {
      timestamp: new Date().toISOString(),
      operationName,
      success: result.success,
      executedOperations: result.executedOperations,
      rollbackOperations: result.rollbackOperations,
      errorCount: result.errors.length,
      errors: result.errors.map((e) => e.message),
    };

    if (result.success) {
      console.log(`[TRANSACTION_SUCCESS] ${operationName}`, logData);
    } else {
      console.error(`[TRANSACTION_FAILURE] ${operationName}`, logData);
    }
  }
}
