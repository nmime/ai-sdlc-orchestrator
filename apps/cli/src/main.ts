import { DslValidator, DslCompiler, type CompiledWorkflow, type CompiledStep } from '@app/workflow-dsl';
import { readFile } from './file-reader';

function printUsage(): void {
  console.log(`Usage:
  ai-sdlc validate <file>           Validate a DSL YAML file
  ai-sdlc diff <file1> <file2>      Compare two compiled DSL files
  ai-sdlc drain-status              Show current drain status`);
}

function cmdValidate(file: string): void {
  const content = readFile(file);
  const validator = new DslValidator();
  const result = validator.validate(content);

  if (result.isOk()) {
    console.log(`✓ ${file} is valid`);
    process.exit(0);
  } else {
    const err = result.error;
    console.error(`✗ ${file} is invalid: ${err.message}`);
    const errors = err.details?.['errors'] as Array<{ path: string; message: string }> | undefined;
    if (errors) {
      for (const e of errors) {
        console.error(`  - [${e.path}] ${e.message}`);
      }
    }
    process.exit(1);
  }
}

function stepSummary(step: CompiledStep): Record<string, unknown> {
  return {
    id: step.id,
    type: step.type,
    action: step.action,
    timeoutMs: step.timeoutMs,
    onSuccess: step.onSuccess,
    onFailure: step.onFailure,
    branches: step.branches?.length,
    childSteps: step.childSteps?.length,
  };
}

function diffObjects(label: string, a: unknown, b: unknown): string[] {
  const lines: string[] = [];
  const aStr = JSON.stringify(a, null, 2);
  const bStr = JSON.stringify(b, null, 2);
  if (aStr !== bStr) {
    lines.push(`  ${label}:`);
    lines.push(`    - ${aStr}`);
    lines.push(`    + ${bStr}`);
  }
  return lines;
}

function cmdDiff(file1: string, file2: string): void {
  const compiler = new DslCompiler();
  const content1 = readFile(file1);
  const content2 = readFile(file2);

  const result1 = compiler.compile(content1);
  const result2 = compiler.compile(content2);

  if (result1.isErr()) {
    console.error(`✗ Failed to compile ${file1}: ${result1.error.message}`);
    process.exit(1);
  }
  if (result2.isErr()) {
    console.error(`✗ Failed to compile ${file2}: ${result2.error.message}`);
    process.exit(1);
  }

  const w1 = result1.value;
  const w2 = result2.value;
  const diffs: string[] = [];

  if (w1.name !== w2.name) diffs.push(`name: "${w1.name}" → "${w2.name}"`);
  if (w1.version !== w2.version) diffs.push(`version: ${w1.version} → ${w2.version}`);
  if (w1.taskQueue !== w2.taskQueue) diffs.push(`taskQueue: "${w1.taskQueue}" → "${w2.taskQueue}"`);
  if (w1.timeoutMs !== w2.timeoutMs) diffs.push(`timeoutMs: ${w1.timeoutMs} → ${w2.timeoutMs}`);
  diffs.push(...diffObjects('defaults', w1.defaults, w2.defaults));
  diffs.push(...diffObjects('hooks', w1.hooks, w2.hooks));
  diffs.push(...diffObjects('variables', w1.variables, w2.variables));

  const stepIds1 = new Set(w1.steps.map(s => s.id));
  const stepIds2 = new Set(w2.steps.map(s => s.id));

  for (const id of stepIds1) {
    if (!stepIds2.has(id)) diffs.push(`step removed: ${id}`);
  }
  for (const id of stepIds2) {
    if (!stepIds1.has(id)) diffs.push(`step added: ${id}`);
  }
  for (const id of stepIds1) {
    if (stepIds2.has(id)) {
      const s1 = w1.stepMap[id];
      const s2 = w2.stepMap[id];
      if (!s1 || !s2) continue;
      const summary1 = stepSummary(s1);
      const summary2 = stepSummary(s2);
      const stepDiff = diffObjects(`step[${id}]`, summary1, summary2);
      diffs.push(...stepDiff);
    }
  }

  if (diffs.length === 0) {
    console.log('No structural differences found.');
  } else {
    console.log(`Differences between ${file1} and ${file2}:`);
    for (const line of diffs) {
      console.log(line);
    }
  }
}

async function cmdDrainStatus(): Promise<void> {
  const temporalAddress = process.env['TEMPORAL_ADDRESS'] || 'localhost:7233';
  const namespace = process.env['TEMPORAL_NAMESPACE'] || 'default';
  const taskQueue = 'orchestrator-queue';

  console.log(`Temporal: ${temporalAddress} (namespace: ${namespace})`);
  console.log(`Task Queue: ${taskQueue}`);

  try {
    const { Connection, Client } = await import('@temporalio/client');
    const connection = await Connection.connect({ address: temporalAddress });
    const client = new Client({ connection, namespace });

    const activeWorkflows: string[] = [];
    const handle = client.workflow.list({
      query: `TaskQueue = '${taskQueue}' AND ExecutionStatus = 'Running'`,
    });
    for await (const wf of handle) {
      activeWorkflows.push(wf.workflowId);
      if (activeWorkflows.length >= 100) break;
    }

    console.log(`Active workflows: ${activeWorkflows.length}`);
    if (activeWorkflows.length > 0) {
      console.log('Running workflow IDs:');
      for (const id of activeWorkflows.slice(0, 20)) {
        console.log(`  - ${id}`);
      }
      if (activeWorkflows.length > 20) {
        console.log(`  ... and ${activeWorkflows.length - 20} more`);
      }
    }

    console.log(activeWorkflows.length > 0
      ? 'System has active workflows. Drain not complete.'
      : 'System is drained. No active workflows.');

    connection.close();
  } catch (error) {
    console.error(`Failed to connect to Temporal: ${(error as Error).message}`);
    console.log('Falling back to static status...');
    console.log('Drain status: UNKNOWN (cannot reach Temporal)');
    process.exit(1);
  }
}

export function run(args: string[]): void {
  const command = args[0];

  switch (command) {
    case 'validate':
      if (!args[1]) {
        console.error('Error: validate requires a file argument');
        printUsage();
        process.exit(1);
      }
      cmdValidate(args[1]);
      break;
    case 'diff':
      if (!args[1] || !args[2]) {
        console.error('Error: diff requires two file arguments');
        printUsage();
        process.exit(1);
      }
      cmdDiff(args[1], args[2]);
      break;
    case 'drain-status':
      cmdDrainStatus();
      break;
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

if (process.env.VITEST === undefined) run(process.argv.slice(2));
