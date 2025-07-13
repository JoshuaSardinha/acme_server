// test/mocks/sequelize.mocks.ts
import { getConnectionToken } from '@nestjs/sequelize';

export const createMockSequelize = () => ({
  provide: getConnectionToken(),
  useValue: {
    transaction: jest.fn().mockImplementation((callback) => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn(),
      };
      return callback ? callback(mockTransaction) : Promise.resolve(mockTransaction);
    }),
  },
});

// Mock instance class for Sequelize models
export class MockSequelizeInstance {
  id: string;

  constructor(data: any) {
    Object.assign(this, data);
    this.id = (data as any).id || `generated-${Math.random().toString(36).substr(2, 9)}`;
  }

  save = jest.fn().mockImplementation(() => Promise.resolve(this));
  reload = jest.fn().mockImplementation(() => Promise.resolve(this));
  update = jest.fn().mockImplementation((updateData: any) => {
    Object.assign(this, updateData);
    return Promise.resolve(this);
  });
  destroy = jest.fn().mockResolvedValue(undefined);
  toJSON = jest.fn().mockImplementation(() => {
    const { save, reload, update, destroy, toJSON, ...data } = this as any;
    return data;
  });
}

// Standard mock model factory
export const createMockModel = (modelName: string) => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  findAndCountAll: jest.fn(),
  create: jest.fn().mockImplementation((data: any, options?: any) => {
    return Promise.resolve(new MockSequelizeInstance(data));
  }),
  update: jest.fn(),
  destroy: jest.fn(),
  count: jest.fn(),
});
