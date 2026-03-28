# Contributing

Thank you for your interest in contributing to AI SDLC Orchestrator!

## Getting Started

1. Fork and clone the repo
2. Install dependencies: `pnpm install`
3. Copy `.env.example` to `.env` and fill in values
4. Start infrastructure: `docker compose -f docker/docker-compose.yml up -d`
5. Run tests: `pnpm test`

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass: `pnpm test`
4. Ensure TypeScript compiles: `npx tsc --noEmit`
5. Commit with a descriptive message
6. Open a pull request

## Code Style

- TypeScript strict mode is enabled
- Use `class-validator` decorators for DTO validation
- Follow existing patterns for controllers, services, and entities
- Avoid adding comments unless necessary for complex logic

## Testing

- Unit tests use Vitest
- Place tests in `__tests__/` directories alongside source files
- Name test files `*.spec.ts`

## Reporting Issues

Use GitHub Issues with the provided templates for bugs and feature requests.

## Security

See [SECURITY.md](./SECURITY.md) for reporting security vulnerabilities.
