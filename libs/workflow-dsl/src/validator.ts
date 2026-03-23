import { Result } from 'neverthrow';
import { workflowDslSchema } from './schema';
import { parse as parseYaml } from 'yaml';
import type { AppError } from '@ai-sdlc/common/result/app-error';
import { ResultUtils } from '@ai-sdlc/common/result/result.utils';

export class DslValidator {
  validate(yamlContent: string): Result<true, AppError> {
    let parsed: unknown;
    try {
      parsed = parseYaml(yamlContent);
    } catch (e) {
      return ResultUtils.err('VALIDATION_ERROR', `Invalid YAML: ${(e as Error).message}`);
    }

    const result = workflowDslSchema.safeParse(parsed);
    if (!result.success) {
      return ResultUtils.err('VALIDATION_ERROR', 'DSL validation failed', {
        errors: result.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const stepNames = new Set<string>();
    for (const step of result.data.steps) {
      if (stepNames.has(step.name)) {
        return ResultUtils.err('VALIDATION_ERROR', `Duplicate step name: ${step.name}`);
      }
      stepNames.add(step.name);

      if (step.type === 'signal_wait' && !step.signal) {
        return ResultUtils.err('VALIDATION_ERROR', `Step '${step.name}' of type signal_wait requires a signal name`);
      }

      if (step.type === 'loop' && !step.maxIterations) {
        return ResultUtils.err('VALIDATION_ERROR', `Step '${step.name}' of type loop requires maxIterations`);
      }

      if (step.recoveryStep && !result.data.steps.find((s) => s.name === step.recoveryStep)) {
        return ResultUtils.err('VALIDATION_ERROR', `Recovery step '${step.recoveryStep}' not found`);
      }
    }

    return ResultUtils.ok(true);
  }
}
