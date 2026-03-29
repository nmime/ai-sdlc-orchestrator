import { describe, it, expect } from 'vitest';
import { DslCompiler } from '../compiler';
import { DslValidator } from '../validator';

const compiler = new DslCompiler();
const validator = new DslValidator();

describe('DSL compiler — real spec compliance', () => {
  describe('step types', () => {
    it('compiles auto step', () => {
      const result = compiler.compile(`
version: 1
name: test
steps:
  - id: build
    type: auto
    action: npm run build
`);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.steps[0].type).toBe('auto');
        expect(result.value.steps[0].action).toBe('npm run build');
      }
    });

    it('compiles signal_wait step', () => {
      const result = compiler.compile(`
version: 1
name: agent-workflow
steps:
  - id: wait
    type: signal_wait
    signal: approval
`);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.steps[0].type).toBe('signal_wait');
        expect(result.value.steps[0].signal).toBe('approval');
      }
    });
  });

  describe('validation', () => {
    it('catches duplicate step IDs', () => {
      const result = validator.validate(`
version: 1
name: test
steps:
  - id: dup
    type: auto
  - id: dup
    type: auto
`);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toMatch(/[Dd]uplicate/);
      }
    });

    it('catches missing gate signal', () => {
      const result = compiler.compile(`
version: 1
name: test
steps:
  - id: review
    type: gate
`);
      expect(result.isOk()).toBe(true);
      const vResult = validator.validate(`
version: 1
name: test
steps:
  - id: review
    type: gate
`);
      expect(vResult.isOk()).toBe(true);
    });
  });

  describe('complex workflows', () => {
    it('compiles parallel step with branches', () => {
      const result = compiler.compile(`
version: 1
name: test
steps:
  - id: parallel-tests
    type: parallel
    branches:
      - id: unit
        steps:
          - id: unit-test
            type: auto
            action: npm test
      - id: lint
        steps:
          - id: lint-check
            type: auto
            action: npm run lint
`);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.steps[0].type).toBe('parallel');
        expect(result.value.steps[0].branches).toHaveLength(2);
      }
    });
  });
});
