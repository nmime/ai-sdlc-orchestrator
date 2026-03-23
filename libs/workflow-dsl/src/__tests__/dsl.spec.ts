import { DslCompiler } from '../compiler';
import { DslValidator } from '../validator';

describe('DslCompiler', () => {
  const compiler = new DslCompiler();

  it('should compile a valid DSL YAML', () => {
    const yaml = `
version: 1
name: "test-workflow"
taskQueue: "test-queue"
timeout_minutes: 120
steps:
  - id: code
    type: auto
    timeout_minutes: 30
  - id: review_gate
    type: gate
    timeout_minutes: 1440
  - id: ci_wait
    type: signal_wait
    signal: ci_result
    timeout_minutes: 60
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('test-workflow');
      expect(result.value.taskQueue).toBe('test-queue');
      expect(result.value.timeoutMs).toBe(7200000);
      expect(result.value.steps).toHaveLength(3);
      expect(result.value.steps[0].id).toBe('code');
      expect(result.value.steps[0].type).toBe('auto');
      expect(result.value.steps[0].timeoutMs).toBe(1800000);
      expect(result.value.steps[1].type).toBe('gate');
      expect(result.value.steps[2].type).toBe('signal_wait');
      expect(result.value.steps[2].signal).toBe('ci_result');
      expect(result.value.checksum).toBeDefined();
      expect(result.value.compiledAt).toBeDefined();
    }
  });

  it('should return error for invalid YAML', () => {
    const result = compiler.compile('{ invalid yaml [[[');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should return error for missing version', () => {
    const yaml = `
name: "test"
steps:
  - id: code
    type: auto
`;
    const result = compiler.compile(yaml);
    expect(result.isErr()).toBe(true);
  });

  it('should use defaults when not specified', () => {
    const yaml = `
version: 1
name: "minimal-workflow"
steps:
  - id: code
    type: auto
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.taskQueue).toBe('orchestrator-queue');
      expect(result.value.timeoutMs).toBe(14400000);
      expect(result.value.defaults.agentProvider).toBe('claude');
      expect(result.value.defaults.sandboxProvider).toBe('e2b');
      expect(result.value.defaults.maxRetries).toBe(3);
    }
  });

  it('should compile nested parallel steps', () => {
    const yaml = `
version: 1
name: "parallel-workflow"
steps:
  - id: parallel_tasks
    type: parallel
    steps:
      - id: task_a
        type: auto
        timeout_minutes: 10
      - id: task_b
        type: auto
        timeout_minutes: 15
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.steps[0].childSteps).toHaveLength(2);
      expect(result.value.steps[0].childSteps![0].id).toBe('task_a');
    }
  });

  it('should compile loop step with maxIterations', () => {
    const yaml = `
version: 1
name: "loop-workflow"
steps:
  - id: fix_loop
    type: loop
    timeout_minutes: 120
    loop_strategy:
      max_iterations: 5
      no_progress_limit: 2
      escalation_threshold: 3
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.steps[0].loopStrategy!.maxIterations).toBe(5);
      expect(result.value.steps[0].loopStrategy!.noProgressLimit).toBe(2);
      expect(result.value.steps[0].loopStrategy!.escalationThreshold).toBe(3);
    }
  });

  it('should compile steps with various timeout values', () => {
    const yaml = `
version: 1
name: "durations"
steps:
  - id: short
    type: auto
    timeout_minutes: 1
  - id: medium
    type: auto
    timeout_minutes: 45
  - id: long
    type: auto
    timeout_minutes: 120
  - id: very_long
    type: auto
    timeout_minutes: 1440
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.steps[0].timeoutMs).toBe(60000);
      expect(result.value.steps[1].timeoutMs).toBe(2700000);
      expect(result.value.steps[2].timeoutMs).toBe(7200000);
      expect(result.value.steps[3].timeoutMs).toBe(86400000);
    }
  });
});

describe('DslValidator', () => {
  const validator = new DslValidator();

  it('should validate a correct DSL', () => {
    const yaml = `
version: 1
name: "valid"
steps:
  - id: code
    type: auto
`;
    const result = validator.validate(yaml);
    expect(result.isOk()).toBe(true);
  });

  it('should reject duplicate step names', () => {
    const yaml = `
version: 1
name: "duplicate-steps"
steps:
  - id: code
    type: auto
  - id: code
    type: auto
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain('Duplicate step id');
    }
  });

  it('should reject signal_wait without signal', () => {
    const yaml = `
version: 1
name: "no-signal"
steps:
  - id: wait
    type: signal_wait
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain('signal_wait requires a signal name');
    }
  });

  it('should reject loop without maxIterations', () => {
    const yaml = `
version: 1
name: "no-max-iter"
steps:
  - id: loop
    type: loop
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain('loop requires loop_strategy');
    }
  });

  it('should reject invalid recovery step reference', () => {
    const yaml = `
version: 1
name: "bad-recovery"
steps:
  - id: code
    type: auto
    on_failure: nonexistent
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain('references unknown on_failure target');
    }
  });
});
