# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multi-tenant SDLC orchestration with Temporal workflows
- AI agent integration (Claude Code) with sandbox execution
- Webhook processing for GitHub, GitLab, Jira, Linear
- Credential proxy with session-based access control
- Cost tracking and budget enforcement per tenant
- Gate-based approval workflow with RBAC
- Prompt sanitization and output scanning
- MCP (Model Context Protocol) server policy enforcement
- Polling-based task discovery for platforms without webhooks
- SSE endpoint for real-time workflow updates
- Comprehensive test suite (300+ tests)

### Security
- OIDC-based authentication with API key support
- Role-based access control (admin, operator, viewer)
- AES-256-GCM encryption for sensitive data
- Webhook signature verification (GitHub, GitLab, Jira, Linear)
- Rate limiting on all public endpoints
- Input sanitization against prompt injection
- Credential isolation per workflow session
