import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class DbCleanerService {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async cleanDb(): Promise<void> {
    try {
      // Get all model names
      const modelNames = Object.keys(this.sequelize.models);

      if (modelNames.length === 0) {
        console.log('No models found, skipping database cleanup');
        return;
      }

      // Try to disable foreign key checks, but proceed if we don't have permission
      let foreignKeyChecksDisabled = false;
      try {
        await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        foreignKeyChecksDisabled = true;
      } catch (permissionError) {
        console.log(
          'Cannot disable foreign key checks (insufficient privileges), using ordered deletion'
        );
      }

      if (foreignKeyChecksDisabled) {
        // If we can disable foreign key checks, truncate all tables
        for (const modelName of modelNames) {
          try {
            const model = this.sequelize.models[modelName];
            const tableName = model.getTableName();

            // Check if table exists before truncating
            const [results] = await this.sequelize.query(`SHOW TABLES LIKE '${tableName}'`);

            if (results.length > 0) {
              await model.truncate({ force: true, cascade: true });
              console.log(`Truncated table: ${tableName}`);
            }
          } catch (modelError) {
            console.warn(`Failed to truncate table for model ${modelName}:`, modelError.message);
          }
        }

        await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      } else {
        // If we can't disable foreign key checks, delete in correct order
        const deletionOrder = [
          'RolePermission',
          'UserPermission',
          'UserRole',
          'TeamMember',
          'Team',
          'Permission',
          'Role',
          'User',
          'Company',
        ];

        for (const modelName of deletionOrder) {
          if (this.sequelize.models[modelName]) {
            try {
              await this.sequelize.models[modelName].destroy({
                where: {},
                force: true,
              });
              console.log(`Deleted all records from: ${modelName}`);
            } catch (modelError) {
              console.warn(`Failed to delete from ${modelName}:`, modelError.message);
            }
          }
        }

        // Clean any remaining models not in the ordered list
        for (const modelName of modelNames) {
          if (!deletionOrder.includes(modelName)) {
            try {
              await this.sequelize.models[modelName].destroy({
                where: {},
                force: true,
              });
              console.log(`Deleted all records from: ${modelName}`);
            } catch (modelError) {
              console.warn(`Failed to delete from ${modelName}:`, modelError.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during database cleanup:', error.message);
      throw error;
    }
  }

  async resetAutoIncrement(): Promise<void> {
    try {
      const modelNames = Object.keys(this.sequelize.models);

      for (const modelName of modelNames) {
        const model = this.sequelize.models[modelName];
        const tableName = model.getTableName();

        // MySQL syntax (SQLite support removed)
        await this.sequelize.query(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1`);
      }
    } catch (error) {
      console.warn('Warning: Could not reset auto-increment counters:', error.message);
    }
  }

  async cleanAndResetDb(): Promise<void> {
    await this.cleanDb();
    await this.resetAutoIncrement();
  }

  // Alias for compatibility with E2E tests
  async cleanAll(): Promise<void> {
    return this.cleanAndResetDb();
  }
}
