import { describe, it, expect } from 'vitest';
import { sanitizeRecord } from '../validation/sanitize-record';

describe('sanitizeRecord', () => {
  it('passes through simple objects', () => {
    const result = sanitizeRecord({ a: 'hello', b: 42, c: true });
    expect(result).toEqual({ a: 'hello', b: 42, c: true });
  });

  it('strips __proto__ keys', () => {
    const obj = Object.create(null);
    obj['__proto__'] = 'evil';
    obj['safe'] = 'ok';
    const result = sanitizeRecord(obj);
    expect(result).toEqual({ safe: 'ok' });
  });

  it('strips constructor and prototype keys', () => {
    const obj = Object.create(null);
    obj.constructor = 'evil';
    obj.prototype = 'evil';
    obj.name = 'ok';
    const result = sanitizeRecord(obj);
    expect(result).toEqual({ name: 'ok' });
  });

  it('recurses into nested objects', () => {
    const inner = Object.create(null);
    inner.a = 1;
    inner['__proto__'] = 'evil';
    const result = sanitizeRecord({ nested: inner });
    expect(result.nested).toEqual({ a: 1 });
  });

  it('handles arrays with nested objects', () => {
    const result = sanitizeRecord({ items: [{ a: 1 }, { b: 2 }] });
    expect(result).toEqual({ items: [{ a: 1 }, { b: 2 }] });
  });

  it('preserves non-object array items', () => {
    const result = sanitizeRecord({ tags: ['a', 'b', 3] });
    expect(result).toEqual({ tags: ['a', 'b', 3] });
  });

  it('throws on exceeding max depth', () => {
    const deep: Record<string, unknown> = { a: { b: { c: { d: { e: { f: { g: 'too deep' } } } } } } };
    expect(() => sanitizeRecord(deep)).toThrow('maximum nesting depth');
  });

  it('throws on exceeding max keys', () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 101; i++) big[`k${i}`] = 'v';
    expect(() => sanitizeRecord(big)).toThrow('maximum key count');
  });

  it('throws on string exceeding max length', () => {
    expect(() => sanitizeRecord({ long: 'x'.repeat(10_001) })).toThrow('maximum length');
  });

  it('throws on array exceeding max length', () => {
    const arr = Array.from({ length: 101 }, (_, i) => i);
    expect(() => sanitizeRecord({ arr })).toThrow('maximum length');
  });

  it('result has null prototype', () => {
    const result = sanitizeRecord({ a: 1 });
    expect(Object.getPrototypeOf(result)).toBe(null);
  });
});
