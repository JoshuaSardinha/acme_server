import { Sequelize } from 'sequelize-typescript';

/**
 * Helper for creating MySQL test database connections
 * Replaces SQLite with MySQL for all entity tests
 */
export class TestDatabaseHelper {
  private static sequelize: Sequelize;

  /**
   * Create a MySQL test database connection
   * @param models Array of Sequelize models to register
   * @returns Configured Sequelize instance
   */
  static async createTestDatabase(models: any[]): Promise<Sequelize> {
    // Use environment variables from .env.test
    const host = process.env.DB_HOST;
    const port = parseInt(process.env.DB_PORT || '3306');
    const username = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host || !port || !username || !password || !database) {
      throw new Error('Required database environment variables are not set. Check .env.test file.');
    }

    this.sequelize = new Sequelize({
      dialect: 'mysql',
      dialectModule: require('mysql2'),
      host,
      port,
      username,
      password,
      database,
      logging: false, // Disable logging for tests
      models,
      define: {
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    });

    // Test the connection
    try {
      await this.sequelize.authenticate();
      console.log(`Connected to MySQL test database: ${database}`);
    } catch (error) {
      console.error('Unable to connect to the test database:', error);
      throw error;
    }

    // Sync models (create tables)
    await this.sequelize.sync({ force: true });

    return this.sequelize;
  }

  /**
   * Clean up all test data from tables
   * @param models Array of models to clean
   */
  static async cleanDatabase(models: any[]): Promise<void> {
    if (!this.sequelize) {
      throw new Error('Database not initialized. Call createTestDatabase first.');
    }

    // Disable foreign key checks for cleanup
    await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      // Clean tables in reverse order to avoid foreign key issues
      for (const model of models.reverse()) {
        await model.destroy({ where: {}, truncate: true, force: true });
      }
    } finally {
      // Re-enable foreign key checks
      await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }

  /**
   * Close the database connection
   */
  static async closeDatabase(): Promise<void> {
    if (this.sequelize) {
      await this.sequelize.close();
      // this.sequelize = null;
    }
  }

  /**
   * Get the current Sequelize instance
   */
  static getSequelize(): Sequelize {
    if (!this.sequelize) {
      throw new Error('Database not initialized. Call createTestDatabase first.');
    }
    return this.sequelize;
  }

  /**
   * Create a test database with isolated schema for parallel testing
   * Useful for running tests in parallel without conflicts
   */
  static async createIsolatedTestDatabase(models: any[], suffix: string): Promise<Sequelize> {
    const baseDatabase = process.env.DB_NAME;
    if (!baseDatabase) {
      throw new Error('DB_NAME environment variable is not set.');
    }
    const isolatedDatabase = `${baseDatabase}_${suffix}`;

    // Create a connection to MySQL without specifying a database
    const rootSequelize = new Sequelize({
      dialect: 'mysql',
      dialectModule: require('mysql2'),
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      logging: false,
    });

    try {
      // Create the isolated database
      await rootSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${isolatedDatabase}\``);
      await rootSequelize.close();

      // Now connect to the isolated database
      process.env.DB_NAME = isolatedDatabase;
      return await this.createTestDatabase(models);
    } catch (error) {
      await rootSequelize.close();
      throw error;
    }
  }

  /**
   * Drop an isolated test database
   */
  static async dropIsolatedTestDatabase(suffix: string): Promise<void> {
    const baseDatabase = process.env.DB_NAME;
    if (!baseDatabase) {
      throw new Error('DB_NAME environment variable is not set.');
    }
    const isolatedDatabase = `${baseDatabase}_${suffix}`;

    const rootSequelize = new Sequelize({
      dialect: 'mysql',
      dialectModule: require('mysql2'),
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT as string),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      logging: false,
    });

    try {
      await rootSequelize.query(`DROP DATABASE IF EXISTS \`${isolatedDatabase}\``);
    } finally {
      await rootSequelize.close();
    }
  }
}
