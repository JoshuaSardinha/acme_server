/**
 * Shared utilities for database constraint testing
 */

export interface ConstraintTestConfig {
  tableName: string;
  primaryKey: string;
  foreignKeys?: { column: string; references: string }[];
  uniqueConstraints?: string[][];
  notNullConstraints?: string[];
}

/**
 * Database constraint testing utilities
 */
export class ConstraintTestHelpers {
  /**
   * Test foreign key constraint violation
   */
  static async testForeignKeyConstraint(
    repository: any,
    data: any,
    foreignKeyField: string,
    invalidValue: string = 'non-existent-id'
  ) {
    const testData = { ...data, [foreignKeyField]: invalidValue };

    await expect(repository.create(testData)).rejects.toThrow();
  }

  /**
   * Test unique constraint violation
   */
  static async testUniqueConstraint(repository: any, existingData: any, duplicateField: string) {
    // Create first record
    await repository.create(existingData);

    // Try to create duplicate
    const duplicateData = { ...existingData, id: 'different-id' };
    await expect(repository.create(duplicateData)).rejects.toThrow();
  }

  /**
   * Test NOT NULL constraint violation
   */
  static async testNotNullConstraint(repository: any, data: any, requiredField: string) {
    const testData = { ...data };
    delete testData[requiredField];

    await expect(repository.create(testData)).rejects.toThrow();
  }

  /**
   * Test CASCADE delete behavior
   */
  static async testCascadeDelete(
    parentRepository: any,
    childRepository: any,
    parentId: string,
    childForeignKey: string
  ) {
    // Verify child records exist before delete
    const childrenBefore = await childRepository.findAll({
      where: { [childForeignKey]: parentId },
    });
    expect(childrenBefore.length).toBeGreaterThan(0);

    // Delete parent
    await parentRepository.destroy({ where: { id: parentId } });

    // Verify children are cascaded
    const childrenAfter = await childRepository.findAll({
      where: { [childForeignKey]: parentId },
    });
    expect(childrenAfter.length).toBe(0);
  }

  /**
   * Test transaction rollback on constraint violation
   */
  static async testTransactionRollback(
    sequelize: any,
    repository: any,
    validData: any,
    invalidData: any
  ) {
    const transaction = await sequelize.transaction();

    try {
      // Insert valid data
      await repository.create(validData, { transaction });

      // Try to insert invalid data (should fail)
      await repository.create(invalidData, { transaction });

      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      await transaction.rollback();

      // Verify rollback - valid data should not exist
      const result = await repository.findByPk(validData.id);
      expect(result).toBeNull();
    }
  }
}

/**
 * Performance constraint testing utilities
 */
export class PerformanceConstraintHelpers {
  /**
   * Test index effectiveness for queries
   */
  static async testIndexPerformance(
    sequelize: any,
    tableName: string,
    indexedColumn: string,
    sampleValue: any
  ) {
    const query = `EXPLAIN SELECT * FROM ${tableName} WHERE ${indexedColumn} = :value`;
    const result = await sequelize.query(query, {
      replacements: { value: sampleValue },
      type: sequelize.QueryTypes.SELECT,
    });

    // Check if index is being used (MySQL specific)
    const isUsingIndex = result.some(
      (row: any) => row.type === 'ref' || row.type === 'const' || row.key !== null
    );

    expect(isUsingIndex).toBe(true);
  }

  /**
   * Test query execution time with large datasets
   */
  static async testQueryPerformance(
    repository: any,
    queryFunction: () => Promise<any>,
    maxExecutionTimeMs: number = 1000
  ) {
    const startTime = Date.now();
    await queryFunction();
    const executionTime = Date.now() - startTime;

    expect(executionTime).toBeLessThan(maxExecutionTimeMs);
  }
}
