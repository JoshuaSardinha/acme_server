/**
 * Jest setup file for shared test utilities and global configuration
 */

// Environment variables are now loaded by ConfigModule in AppModule

// Extend Jest matchers
expect.extend({
  toBeValidUuid(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
});

// Global test configuration
jest.setTimeout(30000); // Increase timeout for database tests

// Mock console.log in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error, // Keep error for debugging
};

// Global test utilities
global.testHelpers = {
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
};

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUuid(): R;
    }
  }

  var testHelpers: {
    delay: (ms: number) => Promise<void>;
    generateTestId: () => string;
  };
}

// Export empty object to make this file a module
export {};
