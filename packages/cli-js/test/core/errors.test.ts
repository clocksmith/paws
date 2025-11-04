/**
 * Unit tests for error handling framework
 */

import { expect } from 'chai';
import {
  PawsError,
  ConfigError,
  NetworkError,
  APIError,
  ValidationError,
  isPawsError,
  wrapError,
  ErrorCatalog,
} from '../../src/core/errors';

describe('Error Handling Framework', () => {
  describe('PawsError', () => {
    it('should create error with code and message', () => {
      const error = new ConfigError('Test error');
      expect(error.message).to.equal('Test error');
      expect(error.code).to.equal('PAWS-CONFIG');
      expect(error.name).to.equal('ConfigError');
    });

    it('should include recovery suggestions', () => {
      const error = new ConfigError('Test error', {
        recoverySuggestions: ['Try this', 'Or try that'],
      });
      expect(error.recoverySuggestions).to.have.lengthOf(2);
    });

    it('should format user string correctly', () => {
      const error = new ConfigError('Test error', {
        recoverySuggestions: ['Fix it'],
      });
      const formatted = error.toUserString();
      expect(formatted).to.include('[PAWS-CONFIG]');
      expect(formatted).to.include('Test error');
      expect(formatted).to.include('Fix it');
    });

    it('should include context in log object', () => {
      const error = new APIError('API failed', {
        statusCode: 500,
        provider: 'test-provider',
      });
      const logObj = error.toLogObject();
      expect(logObj.context?.statusCode).to.equal(500);
      expect(logObj.context?.provider).to.equal('test-provider');
    });
  });

  describe('Error Types', () => {
    it('should create NetworkError with retryable=true by default', () => {
      const error = new NetworkError('Connection failed');
      expect(error.retryable).to.be.true;
    });

    it('should create APIError with correct retryable status', () => {
      const retryableError = new APIError('Server error', { statusCode: 500 });
      expect(retryableError.retryable).to.be.true;

      const nonRetryableError = new APIError('Bad request', { statusCode: 400 });
      expect(nonRetryableError.retryable).to.be.false;
    });

    it('should create ValidationError with retryable=false', () => {
      const error = new ValidationError('Invalid input');
      expect(error.retryable).to.be.false;
    });
  });

  describe('Error Catalog', () => {
    it('should create config.fileNotFound error', () => {
      const error = ErrorCatalog.config.fileNotFound('/path/to/config');
      expect(error).to.be.instanceOf(ConfigError);
      expect(error.message).to.include('/path/to/config');
      expect(error.recoverySuggestions.length).to.be.greaterThan(0);
    });

    it('should create api.modelNotFound error', () => {
      const error = ErrorCatalog.api.modelNotFound('openai', 'gpt-5');
      expect(error).to.be.instanceOf(APIError);
      expect(error.message).to.include('gpt-5');
      expect(error.provider).to.equal('openai');
    });

    it('should create validation.required error', () => {
      const error = ErrorCatalog.validation.required('apiKey');
      expect(error).to.be.instanceOf(ValidationError);
      expect(error.field).to.equal('apiKey');
    });
  });

  describe('Error Utilities', () => {
    it('should identify PawsError correctly', () => {
      const pawsError = new ConfigError('test');
      const regularError = new Error('test');

      expect(isPawsError(pawsError)).to.be.true;
      expect(isPawsError(regularError)).to.be.false;
    });

    it('should wrap regular errors', () => {
      const originalError = new Error('Original error');
      const wrapped = wrapError(originalError, 'Context');

      expect(isPawsError(wrapped)).to.be.true;
      expect(wrapped.message).to.include('Context');
      expect(wrapped.message).to.include('Original error');
      expect(wrapped.cause).to.equal(originalError);
    });

    it('should not double-wrap PawsError', () => {
      const originalError = new ConfigError('test');
      const wrapped = wrapError(originalError);

      expect(wrapped).to.equal(originalError);
    });
  });
});
