/**
 * Shared utilities for entity testing to eliminate redundant test patterns
 */

import { validate } from 'class-validator';

export interface EntityTestConfig {
  entityClass: any;
  requiredFields: string[];
  optionalFields?: string[];
  relationships?: string[];
}

/**
 * Test common entity validation patterns
 */
export class EntityTestHelpers {
  /**
   * Test UUID generation and validation
   */
  static async testUuidGeneration(entity: any, uuidField: string = 'id') {
    expect(entity[uuidField]).toBeDefined();
    expect(typeof entity[uuidField]).toBe('string');
    expect(entity[uuidField]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  }

  /**
   * Test timestamp fields (created_at, updated_at)
   */
  static testTimestamps(entity: any) {
    expect(entity.created_at).toBeInstanceOf(Date);
    expect(entity.updated_at).toBeInstanceOf(Date);
    expect(entity.created_at.getTime()).toBeLessThanOrEqual(entity.updated_at.getTime());
  }

  /**
   * Test field validation using class-validator
   */
  static async testFieldValidation(
    EntityClass: any,
    invalidData: any,
    expectedErrorFields: string[]
  ) {
    const entity = Object.assign(new EntityClass(), invalidData);
    const errors = await validate(entity);

    const errorFields = errors.map((error) => error.property);
    expectedErrorFields.forEach((field) => {
      expect(errorFields).toContain(field);
    });
  }

  /**
   * Test string field length constraints
   */
  static async testStringLengthConstraints(EntityClass: any, field: string, maxLength: number) {
    const longString = 'a'.repeat(maxLength + 1);
    const entity = new EntityClass();
    entity[field] = longString;

    const errors = await validate(entity);
    expect(errors.some((error) => error.property === field)).toBe(true);
  }

  /**
   * Test special character handling
   */
  static testSpecialCharacters(entity: any, field: string, testValue: string) {
    entity[field] = testValue;
    expect(entity[field]).toBe(testValue);
  }

  /**
   * Test NOT NULL constraints
   */
  static async testNotNullConstraints(EntityClass: any, requiredFields: string[]) {
    for (const field of requiredFields) {
      const entity = new EntityClass();
      entity[field] = null;

      const errors = await validate(entity);
      expect(errors.some((error) => error.property === field)).toBe(true);
    }
  }
}

/**
 * Common test data generators
 */
export class TestDataFactory {
  static generateCompanyData(overrides: any = {}) {
    return {
      id: 'test-company-id',
      name: 'Test Company',
      company_type: 'VENDOR',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  static generateTeamData(overrides: any = {}) {
    return {
      id: 'test-team-id',
      name: 'Test Team',
      team_type: 'STANDARD',
      company_id: 'test-company-id',
      manager_id: 'test-manager-id',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  static generateUserData(overrides: any = {}) {
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      company_id: 'test-company-id',
      role: 'USER',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }
}
