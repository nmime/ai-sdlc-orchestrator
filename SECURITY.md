# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email security concerns to the maintainers (see `package.json` for contact).
3. Include a description of the vulnerability, steps to reproduce, and any potential impact.
4. You will receive an acknowledgment within 48 hours.
5. A fix will be developed and released as soon as possible.

## Security Practices

- All sensitive configuration is loaded via environment variables (see `.env.example`).
- Encryption keys are required in production (`ENCRYPTION_KEY`).
- OIDC/JWT authentication is enforced when `OIDC_ISSUER_URL` is configured.
- Webhook signatures are verified per platform.
- All user input is validated via NestJS `ValidationPipe` with `class-validator`.
- Prompt injection patterns are detected and blocked by `PromptSanitizer`.
- Agent sandbox execution is isolated via E2B.
- Rate limiting is applied at the API gateway level.
- CORS is restricted to configured origins.
- CSP and security headers are enabled via `@fastify/helmet`.
