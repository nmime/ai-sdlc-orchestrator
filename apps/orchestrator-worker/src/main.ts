import path from 'path';
import { NativeConnection, Worker } from '@temporalio/worker';
import { MikroORM, Options } from '@mikro-orm/postgresql';
import pino from 'pino';

import { initActivities, activities } from '@ai-sdlc/feature-workflow';
import { AgentProviderRegistry } from '@ai-sdlc/feature-agent-registry';
import { ClaudeAgentAdapter } from '@ai-sdlc/feature-agent-claude-code';
import { E2bSandboxAdapter } from '@ai-sdlc/feature-agent-sandbox';
import { PromptFormatter } from '@ai-sdlc/feature-agent-prompt';
import { CredentialProxyClient } from '@ai-sdlc/feature-agent-credential-proxy';
import { PinoLoggerService } from '@ai-sdlc/common';
import type { AppConfig } from '@ai-sdlc/common';
import { initTelemetry } from '@ai-sdlc/common';
import { ConfigService } from '@nestjs/config';
import { config as loadDotenv } from 'dotenv';

loadDotenv();

const otelSdk = initTelemetry('orchestrator-worker');

const ROOT = path.resolve(__dirname, '../../..');

const configService = new ConfigService(process.env) as unknown as ConfigService<AppConfig, true>;

const logger = pino({
  level: configService.get<string>('WORKER_LOG_LEVEL') || 'info',
  transport:
    configService.get<string>('NODE_ENV') !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

async function run() {
  logger.info('Starting orchestrator-worker...');

  const ormConfig: Options = {
    host: configService.get('DATABASE_HOST'),
    port: configService.get('DATABASE_PORT'),
    dbName: configService.get('DATABASE_NAME'),
    user: configService.get('DATABASE_USER'),
    password: configService.get('DATABASE_PASSWORD'),
    entities: ['./dist/libs/db/src/entities'],
    entitiesTs: ['./libs/db/src/entities'],
    allowGlobalContext: true,
  };

  const orm = await MikroORM.init(ormConfig);
  const em = orm.em.fork();
  const pinoLogger = new PinoLoggerService();

  const sandboxAdapter = new E2bSandboxAdapter(configService, pinoLogger);
  const agentRegistry = new AgentProviderRegistry();
  const claudeAdapter = new ClaudeAgentAdapter(configService, pinoLogger);
  agentRegistry.register(claudeAdapter);

  const promptFormatter = new PromptFormatter();
  const credentialProxy = new CredentialProxyClient(configService, pinoLogger);

  initActivities({
    em,
    sandboxAdapter,
    agentRegistry,
    promptFormatter,
    credentialProxy,
  });

  const connection = await NativeConnection.connect({
    address: configService.get('TEMPORAL_ADDRESS'),
  });

  const workflowsPath = path.resolve(ROOT, 'libs/feature/workflow/src/workflows/orchestrate-task.workflow.ts');

  const worker = await Worker.create({
    connection,
    namespace: configService.get('TEMPORAL_NAMESPACE'),
    taskQueue: 'orchestrator-queue',
    workflowsPath,
    activities,
    bundlerOptions: {
      webpackConfigHook: (config) => {
        config.resolve = config.resolve || {};
        (config.resolve as Record<string, unknown>).alias = {
          ...((config.resolve as Record<string, unknown>).alias as Record<string, unknown>),
          '@ai-sdlc/shared-type': path.resolve(ROOT, 'libs/shared-type/src'),
        };
        return config;
      },
    },
  });

  logger.info('Worker started, listening on task queue: orchestrator-queue');

  const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  shutdownSignals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down...`);
      worker.shutdown();
      await orm.close();
    });
  });

  await worker.run();
}

run().catch((err) => {
  logger.fatal(err, 'Worker failed to start');
  process.exit(1);
});
