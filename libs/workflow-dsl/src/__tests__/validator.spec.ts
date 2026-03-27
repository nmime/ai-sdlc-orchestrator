import { DslValidator } from '../validator';

vi.mock('../schema', () => {
  const z = require('zod');
  const stepSchema = z.object({
    id: z.string(),
    type: z.enum(['agent', 'signal_wait', 'loop', 'gate']),
    signal: z.string().optional(),
    loop_strategy: z.string().optional(),
    on_success: z.string().optional(),
    on_failure: z.string().optional(),
  });
  return {
    workflowDslSchema: z.object({
      name: z.string(),
      version: z.number(),
      steps: z.array(stepSchema),
    }),
  };
});

describe('DslValidator', () => {
  let validator: DslValidator;

  beforeEach(() => {
    validator = new DslValidator();
  });

  it('should validate a correct DSL', () => {
    const yaml = `
name: default
version: 1
steps:
  - id: implement
    type: agent
  - id: review
    type: gate
`;
    const result = validator.validate(yaml);
    expect(result.isOk()).toBe(true);
  });

  it('should return error for invalid YAML syntax', () => {
    const result = validator.validate('{{invalid yaml');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_ERROR');
    expect(result._unsafeUnwrapErr().message).toContain('Invalid YAML');
  });

  it('should return error for schema validation failure', () => {
    const yaml = `
name: 123
steps: not-an-array
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_ERROR');
    expect(result._unsafeUnwrapErr().message).toContain('DSL validation failed');
  });

  it('should detect duplicate step IDs', () => {
    const yaml = `
name: test
version: 1
steps:
  - id: step1
    type: agent
  - id: step1
    type: gate
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('Duplicate step id: step1');
  });

  it('should require signal name for signal_wait type', () => {
    const yaml = `
name: test
version: 1
steps:
  - id: wait_step
    type: signal_wait
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('requires a signal name');
  });

  it('should accept signal_wait with signal name', () => {
    const yaml = `
name: test
version: 1
steps:
  - id: wait_step
    type: signal_wait
    signal: pipeline_result
`;
    const result = validator.validate(yaml);
    expect(result.isOk()).toBe(true);
  });

  it('should require loop_strategy for loop type', () => {
    const yaml = `
name: test
version: 1
steps:
  - id: fix_loop
    type: loop
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('requires loop_strategy');
  });

  it('should accept loop with loop_strategy', () => {
    const yaml = `
name: test
version: 1
steps:
  - id: fix_loop
    type: loop
    loop_strategy: retry
`;
    const result = validator.validate(yaml);
    expect(result.isOk()).toBe(true);
  });

  it('should detect unknown on_success target', () => {
    const yaml = `
name: test
version: 1
steps:
  - id: step1
    type: agent
    on_success: nonexistent
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("references unknown on_success target 'nonexistent'");
  });

  it('should detect unknown on_failure target', () => {
    const yaml = `
name: test
version: 1
steps:
  - id: step1
    type: agent
    on_failure: nonexistent
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("references unknown on_failure target 'nonexistent'");
  });

  it('should accept valid on_success/on_failure references', () => {
    const yaml = `
name: test
version: 1
steps:
  - id: step1
    type: agent
    on_success: step2
    on_failure: step2
  - id: step2
    type: gate
`;
    const result = validator.validate(yaml);
    expect(result.isOk()).toBe(true);
  });
});
