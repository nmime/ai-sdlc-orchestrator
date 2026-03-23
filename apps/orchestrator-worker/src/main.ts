import { NativeConnection, Worker } from '@temporalio/worker';
import { MikroORM, Options } from '@mikro-orm/postgresql';
import pino from 'pino';
import { initActivities } from '@ai-sdlc/feature-workflow';
import { AgentProviderRegistry } from '@ai-sdlc/feature-agent-registry';
import { ClaudeAgentAdapter } from '@ai-sdlc/feature-agent-claude-code';
import { E2bSandboxAdapter } from '@ai-sdlc/feature-agent-sandbox';
import { PromptFormatter } from '@ai-sdlc/feature-agent-prompt';
import { CredentialProxyClient } from '@ai-sdlc/feature-agent-credential-proxy';
import { PinoLoggerService } from '@ai-sdlc/common';
import { ConfigService } from '@nestjs/config';

const logger = pino({
  level: process.env['WORKER_LOG_LEVEL'] || 'info',
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

async function run() {
  logger.info('Starting orchestrator-worker...');

  const ormConfig: Options = {
    host: process.env['DATABASE_HOST'] || 'localhost',
    port: parseInt(process.env['DATABASE_PORT'] || '6432', 10),
    dbName: process.env['DATABASE_NAME'] || 'orchestrator',
    user: process.env['DATABASE_USER'] || 'orchestrator',
    password: process.env['DATABASE_PASSWORD'] || 'orchestrator_dev',
    entities: ['./dist/libs/db/src/entities'],
    entitiesTs: ['./libs/db/src/entities'],
    allowGlobalContext: true,
  };

  const orm = await MikroORM.init(ormConfig);

  const em = orm.em.fork();
  const pinoLogger = new PinoLoggerService();
  const configService = new ConfigService(process.env);

  const sandboxAdapter = new E2bSandboxAdapter(configService as any, pinoLogger);
  const agentRegistry = new AgentProviderRegistry();
  const claudeAdapter = new ClaudeAgentAdapter(configService as any, pinoLogger);
  agentRegistry.register(claudeAdapter);

  const promptFormatter = new PromptFormatter();
  const credentialProxy = new CredentialProxyClient(pinoLogger);

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

  const worker = await Worker.create({
    connection,
    namespace: process.env['TEMPORAL_NAMESPACE'] || 'default',
    taskQueue: 'orchestrator-queue',
    workflowsPath: require.resolve('@ai-sdlc/feature-workflow'),
    activities: require('@ai-sdlc/feature-workflow').activities,
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
