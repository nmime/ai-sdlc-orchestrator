# Contributing to AI SDLC Orchestrator

Thank you for considering contributing! We welcome contributions from everyone.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/ai-sdlc-orchestrator.git`
3. Install dependencies: `pnpm install`
4. Start infrastructure: `docker compose -f docker-compose.dev.yml up -d`
5. Copy environment: `cp .env.example .env`
6. Run tests: `pnpm test`

## Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Ensure all checks pass:
   - `pnpm lint` — zero errors/warnings
   - `pnpm build` — all projects build
   - `pnpm test` — all tests pass
   - `npx tsc --noEmit` — zero type errors
4. Commit using conventional commits: `feat: add X`, `fix: resolve Y`
5. Push and open a Pull Request

## Code Standards

- **Zero suppressions**: No `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `as any`, or non-null assertions (`!`) in source code
- **Strict TypeScript**: `strict: true`, `noUncheckedIndexedAccess: true`
- **Path aliases**: Use `@app/` prefix (e.g., `@app/common`, `@app/db`)
- **Error handling**: Use `neverthrow` `Result` types in services; controllers use `ResultUtils.unwrapOrThrow`
- **No comments**: Keep code self-documenting; avoid inline comments unless absolutely necessary

## Architecture

- **NX monorepo** with apps (`orchestrator-api`, `orchestrator-worker`, `credential-proxy`, `cli`, `dashboard`) and libs (`common`, `db`, `shared-type`, `workflow-dsl`, `feature/*`)
- **Port/Adapter pattern**: `AiAgentPort` and `SandboxPort` interfaces for extensibility
- **NestJS + Fastify** for API
- **Temporal.io** for workflow orchestration
- **MikroORM + PostgreSQL** for persistence

## Reporting Issues

Please use GitHub Issues with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
