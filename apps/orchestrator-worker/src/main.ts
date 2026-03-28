import path from 'path';
import { NativeConnection, Worker } from '@temporalio/worker';
import { MikroORM, Options } from '@mikro-orm/postgresql';
import pino from 'pino';

import { initActivities, activities } from '@app/feature-workflow';
import { AgentProviderRegistry } from '@app/feature-agent-registry';
import { E2bSandboxAdapter } from '@app/feature-agent-sandbox';
import { PromptFormatter } from '@app/feature-agent-prompt';
import { CredentialProxyClient } from '@app/feature-agent-credential-proxy';
import { PinoLoggerService } from '@app/common';
import type { AppConfig } from '@app/common';
import type { AiAgentPort } from '@app/feature-agent-registry';
import { ConfigService } from '@nestjs/config';

const ROOT = process.env['APP_ROOT'] || path.resolve(__dirname, '../../..');

const logger = pino({
  level: process.env['WORKER_LOG_LEVEL'] || 'info',
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

async function loadAdapters(configService: ConfigService<AppConfig, true>, pinoLogger: PinoLoggerService): Promise<AiAgentPort[]> {
  const adapters: AiAgentPort[] = [];

  if (configService.get('ANTHROPIC_API_KEY', { infer: true })) {
    const { ClaudeAgentAdapter } = await import('@app/feature-agent-claude-code');
    adapters.push(new ClaudeAgentAdapter(configService, pinoLogger));
    logger.info('Loaded agent adapter: claude_code');
  }

  if (adapters.length === 0) {
    logger.warn('No agent adapters loaded. Set ANTHROPIC_API_KEY (or other provider keys) to enable agent capabilities.');
  }

  return adapters;
}

async function run() {
  logger.info('Starting orchestrator-worker...');

  if (!process.env['DATABASE_PASSWORD']) {
    throw new Error('DATABASE_PASSWORD environment variable is required');
  }

  const ormConfig: Options = {
    host: process.env['DATABASE_HOST'] || 'localhost',
    port: parseInt(process.env['DATABASE_PORT'] || '6432', 10),
    dbName: process.env['DATABASE_NAME'] || 'orchestrator',
    user: process.env['DATABASE_USER'] || 'orchestrator',
    password: process.env['DATABASE_PASSWORD'],
    entities: ['./dist/libs/db/src/entities'],
    entitiesTs: ['./libs/db/src/entities'],
    allowGlobalContext: true,
  };

  const orm = await MikroORM.init(ormConfig);
  const em = orm.em.fork();
  const pinoLogger = new PinoLoggerService();
  const configService = new ConfigService<AppConfig, true>(process.env as Record<string, string>);

  const sandboxAdapter = new E2bSandboxAdapter(configService, pinoLogger);
  const agentRegistry = new AgentProviderRegistry(configService);

  const adapters = await loadAdapters(configService, pinoLogger);
  for (const adapter of adapters) {
    agentRegistry.register(adapter);
  }

  const promptFormatter = new PromptFormatter();
  const credentialProxy = new CredentialProxyClient(pinoLogger, configService);

  initActivities({
    em,
    sandboxAdapter,
    agentRegistry,
    promptFormatter,
    credentialProxy,
  });

  const connection = await NativeConnection.connect({
    address: process.env['TEMPORAL_ADDRESS'] || 'localhost:7233',
  });

  const workflowsPath = path.resolve(ROOT, 'libs/feature/workflow/src/workflows/orchestrate-task.workflow.ts');

  const worker = await Worker.create({
    connection,
    namespace: process.env['TEMPORAL_NAMESPACE'] || 'default',
    taskQueue: 'orchestrator-queue',
    workflowsPath,
    activities,
    bundlerOptions: {
      webpackConfigHook: (config: any) => {
        config.resolve = config.resolve || {};
        config.resolve.alias = {
          ...config.resolve.alias,
          '@app/shared-type': path.resolve(ROOT, 'libs/shared-type/src'),
        };
        return config;
      },
    },
  });

  logger.info(`Worker started, ${adapters.length} agent adapter(s) loaded, listening on task queue: orchestrator-queue`);

  const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  shutdownSignals.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Received ${signal}, shutting down...`);
      worker.shutdown();
    });
  });

  await worker.run();
  await orm.close();
}

run().catch((err) => {
  logger.fatal(err, 'Worker failed to start');
  process.exit(1);
});
