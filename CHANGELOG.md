# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-12

### Added

- Initial public release of the `@milkstraw/cli` package.
- Interactive authentication via `milkstraw login` using the browser-based device flow.
- Local token revocation and cleanup via `milkstraw logout`.
- End-to-end onboarding via `milkstraw setup`, including organization creation/selection and AWS stack deployment.
- Deployment and onboarding inspection via `milkstraw status`.
- Stack template upgrade flow via `milkstraw update`.
- Organization discovery via `milkstraw org list`.
- Global CLI options for organization selection, AWS profile selection, verbosity, markdown output, JSON output, quiet output, and agent mode.
- Environment variable support for default organization and AWS profile selection.
- AWS integration using the AWS SDK for JavaScript v3 for STS, CloudFormation, and Organizations access.
- Machine-readable output modes for automation and agent-safe execution.
