# Copilot Instructions — E2B

## Project

- **Name**: E2B
- **Organization**: AiFeatures
- **Enterprise**: iAiFy
- **Language**: MDX
- **Description**: Open-source, secure environment with real-world tools for enterprise-grade agents.

## Fork Status

This is a forked repository. Do not contribute back upstream.
Local customizations are preserved in the main branch.
Upstream sync is managed via Ai-road-4-You/fork-sync.

## Conventions

- Use kebab-case for file and directory names
- Use conventional commits (feat:, fix:, chore:, docs:, refactor:, test:)
- All PRs require review before merge
- Branch from main, merge back to main
- All file names in kebab-case

## Shared Infrastructure

- Reusable workflows: Ai-road-4-You/enterprise-ci-cd@v1
- Composite actions: Ai-road-4-You/github-actions@v1
- Governance standards: Ai-road-4-You/governance

## Quality Standards

- Run lint and tests before submitting PRs
- Keep dependencies updated via Dependabot
- No hardcoded secrets — use GitHub Secrets or environment variables
- Follow OWASP Top 10 security practices
