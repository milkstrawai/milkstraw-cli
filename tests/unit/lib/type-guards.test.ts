import { describe, expect, it } from 'vitest';
import { hasMessage, hasName, hasStatusCode, isRecord } from '../../../src/lib/type-guards.js';

describe('type-guards', () => {
  describe('hasName', () => {
    it('returns true for objects with a string name property', () => {
      expect(hasName({ name: 'alice' })).toBe(true);
    });

    it('returns false for objects without a name property', () => {
      expect(hasName({ id: 1 })).toBe(false);
    });

    it('returns false when name is not a string', () => {
      expect(hasName({ name: 123 })).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(hasName(null)).toBe(false);
      expect(hasName('hello')).toBe(false);
    });
  });

  describe('hasMessage', () => {
    it('returns true for objects with a string message property', () => {
      expect(hasMessage({ message: 'error occurred' })).toBe(true);
    });

    it('returns false for objects without a message property', () => {
      expect(hasMessage({ code: 500 })).toBe(false);
    });

    it('returns false when message is not a string', () => {
      expect(hasMessage({ message: 42 })).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(hasMessage(null)).toBe(false);
      expect(hasMessage(undefined)).toBe(false);
    });
  });

  describe('hasStatusCode', () => {
    it('returns true for objects with a numeric statusCode property', () => {
      expect(hasStatusCode({ statusCode: 200 })).toBe(true);
      expect(hasStatusCode({ statusCode: 0 })).toBe(true);
    });

    it('returns false for objects without a statusCode property', () => {
      expect(hasStatusCode({ status: 200 })).toBe(false);
    });

    it('returns false when statusCode is not a number', () => {
      expect(hasStatusCode({ statusCode: '200' })).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(hasStatusCode(null)).toBe(false);
      expect(hasStatusCode(42)).toBe(false);
    });
  });

  describe('isRecord', () => {
    it('returns true for plain objects', () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ a: 1 })).toBe(true);
    });

    it('returns false for arrays', () => {
      expect(isRecord([])).toBe(false);
      expect(isRecord([1, 2])).toBe(false);
    });

    it('returns false for null', () => {
      expect(isRecord(null)).toBe(false);
    });

    it('returns false for primitives', () => {
      expect(isRecord(undefined)).toBe(false);
      expect(isRecord(42)).toBe(false);
      expect(isRecord('hello')).toBe(false);
      expect(isRecord(true)).toBe(false);
    });
  });
});
