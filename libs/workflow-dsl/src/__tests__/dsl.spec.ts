import { DslCompiler } from '../compiler';
import { DslValidator } from '../validator';

describe('DslCompiler', () => {
  const compiler = new DslCompiler();

  it('should compile a valid DSL YAML', () => {
    const yaml = `
version: "1.0"
name: "test-workflow"
taskQueue: "test-queue"
timeout: "2h"
steps:
  - name: code
    type: auto
    timeout: "30m"
  - name: review_gate
    type: gate
    timeout: "24h"
  - name: ci_wait
    type: signal_wait
    signal: ci_result
    timeout: "1h"
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('test-workflow');
      expect(result.value.taskQueue).toBe('test-queue');
      expect(result.value.timeoutMs).toBe(7200000);
      expect(result.value.steps).toHaveLength(3);
      expect(result.value.steps[0].name).toBe('code');
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
  - name: code
    type: auto
`;
    const result = compiler.compile(yaml);
    expect(result.isErr()).toBe(true);
  });

  it('should use defaults when not specified', () => {
    const yaml = `
version: "1.0"
name: "minimal-workflow"
steps:
  - name: code
    type: auto
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.taskQueue).toBe('orchestrator-queue');
      expect(result.value.timeoutMs).toBe(14400000);
      expect(result.value.defaults.agentProvider).toBe('claude_code');
      expect(result.value.defaults.sandboxProvider).toBe('e2b');
      expect(result.value.defaults.maxRetries).toBe(3);
    }
  });

  it('should compile nested parallel steps', () => {
    const yaml = `
version: "1.0"
name: "parallel-workflow"
steps:
  - name: parallel_tasks
    type: parallel
    steps:
      - name: task_a
        type: auto
        timeout: "10m"
      - name: task_b
        type: auto
        timeout: "15m"
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.steps[0].childSteps).toHaveLength(2);
      expect(result.value.steps[0].childSteps![0].name).toBe('task_a');
    }
  });

  it('should compile loop step with maxIterations', () => {
    const yaml = `
version: "1.0"
name: "loop-workflow"
steps:
  - name: fix_loop
    type: loop
    maxIterations: 5
    noProgressThreshold: 2
    escalation: gate
    timeout: "2h"
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.steps[0].maxIterations).toBe(5);
      expect(result.value.steps[0].noProgressThreshold).toBe(2);
      expect(result.value.steps[0].escalation).toBe('gate');
    }
  });

  it('should parse duration strings correctly', () => {
    const yaml = `
version: "1.0"
name: "durations"
steps:
  - name: seconds
    type: auto
    timeout: "30s"
  - name: minutes
    type: auto
    timeout: "45m"
  - name: hours
    type: auto
    timeout: "2h"
  - name: days
    type: auto
    timeout: "1d"
`;
    const result = compiler.compile(yaml);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.steps[0].timeoutMs).toBe(30000);
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
version: "1.0"
name: "valid"
steps:
  - name: code
    type: auto
`;
    const result = validator.validate(yaml);
    expect(result.isOk()).toBe(true);
  });

  it('should reject duplicate step names', () => {
    const yaml = `
version: "1.0"
name: "duplicate-steps"
steps:
  - name: code
    type: auto
  - name: code
    type: auto
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain('Duplicate step name');
    }
  });

  it('should reject signal_wait without signal', () => {
    const yaml = `
version: "1.0"
name: "no-signal"
steps:
  - name: wait
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
version: "1.0"
name: "no-max-iter"
steps:
  - name: loop
    type: loop
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain('loop requires maxIterations');
    }
  });

  it('should reject invalid recovery step reference', () => {
    const yaml = `
version: "1.0"
name: "bad-recovery"
steps:
  - name: code
    type: auto
    recoveryStep: nonexistent
`;
    const result = validator.validate(yaml);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain('Recovery step');
    }
  });
});
