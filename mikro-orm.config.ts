import { defineConfig } from '@mikro-orm/postgresql';

export default defineConfig({
  host: process.env['DATABASE_HOST'] || 'localhost',
  port: parseInt(process.env['DATABASE_PORT'] || '5432', 10),
  dbName: process.env['DATABASE_NAME'] || 'orchestrator',
  user: process.env['DATABASE_USER'] || 'orchestrator',
  password: (() => {
    const pw = process.env['DATABASE_PASSWORD'];
    if (!pw) throw new Error('DATABASE_PASSWORD environment variable is required');
    return pw;
  })(),
  entities: ['./dist/libs/db/src/entities'],
  entitiesTs: ['./libs/db/src/entities'],
  migrations: {
    path: './dist/libs/db/src/migrations',
    pathTs: './libs/db/src/migrations',
  },
});
