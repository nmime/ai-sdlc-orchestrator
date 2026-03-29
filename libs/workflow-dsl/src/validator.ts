import type { Result } from 'neverthrow';
import { workflowDslSchema } from './schema';
import { parse as parseYaml } from 'yaml';
import type { AppError } from '@app/common';
import { ResultUtils } from '@app/common';

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

    const stepIds = new Set<string>();
    for (const step of result.data.steps) {
      if (stepIds.has(step.id)) {
        return ResultUtils.err('VALIDATION_ERROR', `Duplicate step id: ${step.id}`);
      }
      stepIds.add(step.id);

      if (step.type === 'signal_wait' && !step.signal) {
        return ResultUtils.err('VALIDATION_ERROR', `Step '${step.id}' of type signal_wait requires a signal name`);
      }

      if (step.type === 'loop' && !step.loop_strategy) {
        return ResultUtils.err('VALIDATION_ERROR', `Step '${step.id}' of type loop requires loop_strategy`);
      }

      if (step.on_success && !result.data.steps.find((s) => s.id === step.on_success)) {
        return ResultUtils.err('VALIDATION_ERROR', `Step '${step.id}' references unknown on_success target '${step.on_success}'`);
      }

      if (step.on_failure && !result.data.steps.find((s) => s.id === step.on_failure)) {
        return ResultUtils.err('VALIDATION_ERROR', `Step '${step.id}' references unknown on_failure target '${step.on_failure}'`);
      }
    }

    return ResultUtils.ok(true);
  }
}
