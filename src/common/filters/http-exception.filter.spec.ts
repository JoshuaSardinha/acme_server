import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockReflector: Reflector;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(async () => {
    mockReflector = {
      get: jest.fn(),
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/test',
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn().mockReturnValue(() => {}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AllExceptionsFilter,
          useValue: new AllExceptionsFilter(mockReflector),
        },
      ],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('Auth endpoint validation errors', () => {
    beforeEach(() => {
      mockRequest.url = '/auth/login';
    });

    it('should return simple error format for auth endpoints', () => {
      const validationException = new BadRequestException({
        isValidation: true,
        validationErrors: [
          { msg: 'email must be an email', param: 'email', location: 'body' },
          { msg: 'password must be longer than 8 characters', param: 'password', location: 'body' },
        ],
      });

      filter.catch(validationException, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        errors: [
          { msg: 'email must be an email', param: 'email', location: 'body' },
          { msg: 'password must be longer than 8 characters', param: 'password', location: 'body' },
        ],
      });
    });
  });

  describe('Team endpoint validation errors', () => {
    beforeEach(() => {
      mockRequest.url = '/teams';
      mockReflector.get = jest.fn().mockReturnValue(true);
    });

    it('should return team validation format for team endpoints', () => {
      const validationException = new BadRequestException({
        isValidation: true,
        validationErrors: [
          { msg: 'name should not be empty', param: 'name', location: 'body' },
          { msg: 'managerId must be a valid UUID', param: 'managerId', location: 'body' },
        ],
      });

      filter.catch(validationException, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        code: 'TEAM_VALIDATION_ERROR',
        message: 'Invalid company data provided',
        errors: [
          { msg: 'name should not be empty', param: 'name', location: 'body' },
          { msg: 'managerId must be a valid UUID', param: 'managerId', location: 'body' },
        ],
      });
    });
  });

  describe('Standard endpoint validation errors', () => {
    beforeEach(() => {
      mockRequest.url = '/other';
      mockReflector.get = jest.fn().mockReturnValue(false);
    });

    it('should return standard validation format for other endpoints', () => {
      const validationException = new BadRequestException({
        isValidation: true,
        validationErrors: [{ msg: 'field is required', param: 'field', location: 'body' }],
      });

      filter.catch(validationException, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid data provided',
        errors: [{ msg: 'field is required', param: 'field', location: 'body' }],
      });
    });
  });

  describe('Existing error formats', () => {
    it('should preserve existing controller error formats', () => {
      const controllerException = new BadRequestException({
        success: false,
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        payload: { error: 'details' },
      });

      filter.catch(controllerException, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        payload: { error: 'details' },
      });
    });
  });

  describe('isAuthEndpoint', () => {
    it('should correctly identify auth endpoints', () => {
      const isAuthEndpoint = (filter as any).isAuthEndpoint.bind(filter);

      expect(isAuthEndpoint('/auth/login')).toBe(true);
      expect(isAuthEndpoint('/auth/signup')).toBe(true);
      expect(isAuthEndpoint('/auth/refresh')).toBe(true);
      expect(isAuthEndpoint('/auth/user')).toBe(true);
      expect(isAuthEndpoint('/teams')).toBe(false);
      expect(isAuthEndpoint('/companies')).toBe(false);
      expect(isAuthEndpoint('/health')).toBe(false);
      expect(isAuthEndpoint(null)).toBe(false);
      expect(isAuthEndpoint(undefined)).toBe(false);
    });
  });
});
