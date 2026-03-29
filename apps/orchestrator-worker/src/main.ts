import path from 'path';
import { NativeConnection, Worker } from '@temporalio/worker';
import { MikroORM, type Options } from '@mikro-orm/postgresql';
import pino from 'pino';

import { initActivities, activities } from '@app/feature-workflow';
import { AgentProviderRegistry } from '@app/feature-agent-registry';
import { E2bSandboxAdapter } from '@app/feature-agent-sandbox';
import { PromptFormatter } from '@app/feature-agent-prompt';
import { CredentialProxyClient } from '@app/feature-agent-credential-proxy';
import { PinoLoggerService } from '@app/common';
import type { AppConfig } from '@app/common';
import type { AiAgentPort } from '@app/feature-agent-registry';
import type { ProviderType, UnifiedAdapterOpts } from '@app/feature-agent-unified';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

const ROOT = process.env['APP_ROOT'] || path.resolve(__dirname, '../../..');

const logger = pino({
  level: process.env['WORKER_LOG_LEVEL'] || 'info',
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

interface ProviderEntry {
  providerType: ProviderType;
  name: string;
  envKey: string;
}

const NATIVE_PROVIDERS: ProviderEntry[] = [
  { providerType: 'anthropic', name: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
  { providerType: 'openai', name: 'openai', envKey: 'OPENAI_API_KEY' },
  { providerType: 'google', name: 'google', envKey: 'GOOGLE_GENERATIVE_AI_API_KEY' },
  { providerType: 'mistral', name: 'mistral', envKey: 'MISTRAL_API_KEY' },
  { providerType: 'xai', name: 'xai', envKey: 'XAI_API_KEY' },
  { providerType: 'azure', name: 'azure', envKey: 'AZURE_OPENAI_API_KEY' },
  { providerType: 'bedrock', name: 'bedrock', envKey: 'AWS_ACCESS_KEY_ID' },
];

async function loadAdapters(configService: ConfigService<AppConfig, true>, pinoLogger: PinoLoggerService): Promise<AiAgentPort[]> {
  const { UnifiedAgentAdapter } = await import('@app/feature-agent-unified');
  const adapters: AiAgentPort[] = [];

  for (const entry of NATIVE_PROVIDERS) {
    const key = configService.get(entry.envKey as keyof AppConfig, { infer: true });
    if (key) {
      adapters.push(new UnifiedAgentAdapter(configService, pinoLogger, {
        providerType: entry.providerType,
        name: entry.name,
      }));
      logger.info(`✓ Registered ${entry.name} adapter (native SDK)`);
    }
  }

  const extraConfigs = configService.get('AI_PROVIDER_CONFIGS', { infer: true });
  if (extraConfigs) {
    try {
      const configs = JSON.parse(extraConfigs) as Array<{ name: string; baseURL: string; apiKey?: string; model?: string }>;
      for (const cfg of configs) {
        const opts: UnifiedAdapterOpts = {
          providerType: 'openai-compatible',
          name: cfg.name,
          baseURL: cfg.baseURL,
          apiKey: cfg.apiKey,
          model: cfg.model,
        };
        adapters.push(new UnifiedAgentAdapter(configService, pinoLogger, opts));
        logger.info(`✓ Registered ${cfg.name} adapter (openai-compatible → ${cfg.baseURL})`);
      }
    } catch (e) {
      logger.error(`Failed to parse AI_PROVIDER_CONFIGS: ${(e as Error).message}`);
    }
  }

  if (adapters.length === 0) {
    logger.warn(
      'No agent adapters loaded. Set at least one provider key:\n' +
      '  ANTHROPIC_API_KEY    — Claude (recommended)\n' +
      '  OPENAI_API_KEY       — OpenAI / GPT\n' +
      '  GOOGLE_GENERATIVE_AI_API_KEY — Gemini\n' +
      '  MISTRAL_API_KEY      — Mistral\n' +
      '  XAI_API_KEY          — xAI / Grok\n' +
      '  AZURE_OPENAI_API_KEY — Azure OpenAI\n' +
      '  AWS_ACCESS_KEY_ID    — Amazon Bedrock\n' +
      '  AI_PROVIDER_CONFIGS  — JSON array for any OpenAI-compatible endpoint',
    );
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

  const minioAccessKey = configService.get('MINIO_ACCESS_KEY', { infer: true });
  const minioSecretKey = configService.get('MINIO_SECRET_KEY', { infer: true });
  let minioClient: Minio.Client | undefined;
  if (minioAccessKey && minioSecretKey) {
    minioClient = new Minio.Client({
      endPoint: configService.get('MINIO_ENDPOINT', { infer: true }) || 'localhost',
      port: parseInt(configService.get('MINIO_PORT', { infer: true }) || '9000', 10),
      useSSL: configService.get('MINIO_USE_SSL', { infer: true }) === 'true',
      accessKey: minioAccessKey,
      secretKey: minioSecretKey,
    });
    logger.info('MinIO client initialized for artifact uploads');
  } else {
    logger.warn('MinIO credentials not configured — artifact uploads will be skipped');
  }

  const minioBucket = configService.get('MINIO_BUCKET', { infer: true }) || 'opwerf-artifacts';

  initActivities({
    em,
    sandboxAdapter,
    agentRegistry,
    promptFormatter,
    credentialProxy,
    minioClient,
    minioBucket,
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
