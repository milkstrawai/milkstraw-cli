# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-05-05

### Added

- `milkstraw inventory` command group for listing onboarded cloud resources:
  - `ec2 list` — EC2 on-demand instances
  - `rds list` — RDS on-demand instances
  - `elasticache list` — ElastiCache on-demand clusters
  - `opensearch list` — OpenSearch on-demand clusters
  - `eks list` — EKS clusters
  - `ebs list` — EBS volumes
  - `opensearch nodes list` — OpenSearch nodes across all clusters
  - `eks nodegroups list` — EKS node groups across all clusters
- `milkstraw commitments` command group for inspecting Reserved Instances and Savings Plans:
  - `ec2 list` — EC2 Reserved Instances
  - `rds list` — RDS Reserved Instances
  - `elasticache list` — ElastiCache Reserved Instances
  - `opensearch list` — OpenSearch Reserved Instances
  - `savings_plans compute list` — Compute Savings Plans
  - `savings_plans ec2_instance list` — EC2 Instance Savings Plans
  - `savings_plans sage_maker list` — SageMaker Savings Plans
  - `savings_plans database list` — Database Savings Plans
- `--account`, `--region`, `--state` filter options on all inventory and commitments subcommands (where supported by the API).
- Additional filter options on specific subcommands: `--lifecycle`, `--outdated` (EC2, EKS nodegroups), `--capacity`, `--cluster` (EKS nodegroups), `--role`, `--cluster` (OpenSearch nodes).
- Summary footer line on table output showing item count, account count, and region/cluster count.
- Cell formatters (`format.ts`) for consistent rendering of percentages, prices, booleans, and null values.

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
