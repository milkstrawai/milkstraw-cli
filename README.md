# @milkstraw/cli

MilkStraw AI CLI for authentication, onboarding, and stack management.

## Prerequisites

Before running `milkstraw setup`, you need the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured with credentials that have access to your AWS Organization management account.

Configure credentials using one of:

```bash
aws configure      # Access key + secret
aws configure sso  # SSO login (recommended)
```

Verify your credentials are working:

```bash
aws sts get-caller-identity
```

If using SSO, make sure your session is active:

```bash
aws sso login --profile <your-profile>
```

## Quick Start

```bash
npx @milkstraw/cli setup
```

## Commands

| Command | Description |
|---------|-------------|
| `milkstraw login` | Interactive browser login |
| `milkstraw logout` | Revoke token and clear local auth |
| `milkstraw setup` | Complete onboarding and deploy stacks |
| `milkstraw status` | Check deployment status |
| `milkstraw update` | Update deployed stacks to latest templates |
| `milkstraw org list` | List accessible organizations |
| `milkstraw inventory ec2 list` | List EC2 on-demand instances |
| `milkstraw inventory rds list` | List RDS on-demand instances |
| `milkstraw inventory elasticache list` | List ElastiCache on-demand clusters |
| `milkstraw inventory opensearch list` | List OpenSearch on-demand clusters |
| `milkstraw inventory opensearch nodes list` | List OpenSearch nodes across all clusters |
| `milkstraw inventory eks list` | List EKS clusters |
| `milkstraw inventory eks nodegroups list` | List EKS node groups across all clusters |
| `milkstraw inventory ebs list` | List EBS volumes |
| `milkstraw commitments ec2 list` | List EC2 Reserved Instances |
| `milkstraw commitments rds list` | List RDS Reserved Instances |
| `milkstraw commitments elasticache list` | List ElastiCache Reserved Instances |
| `milkstraw commitments opensearch list` | List OpenSearch Reserved Instances |
| `milkstraw commitments savings_plans compute list` | List Compute Savings Plans |
| `milkstraw commitments savings_plans ec2_instance list` | List EC2 Instance Savings Plans |
| `milkstraw commitments savings_plans sage_maker list` | List SageMaker Savings Plans |
| `milkstraw commitments savings_plans database list` | List Database Savings Plans |

## Global Options

| Option | Description |
|--------|-------------|
| `--org <id>` | Specify organization ID |
| `--aws-profile <name>` | Override the AWS named profile |
| `--json` | Output as JSON |
| `--quiet` | Output data only |
| `--markdown` | Output as Markdown |
| `--verbose` | Enable verbose output |
| `--agent` | Agent-safe mode (no prompts, no spinners) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MILKSTRAW_ORG` | Default organization ID |
| `MILKSTRAW_AWS_PROFILE` | Default AWS profile name |

## AWS Credential Resolution

The CLI uses the AWS SDK for JavaScript v3 credential provider chain.

Without `--aws-profile`, credentials are resolved in this order:

1. Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
2. SSO token cache at `~/.aws/sso/cache`
3. Shared credentials file at `~/.aws/credentials` (default profile)
4. Shared config file at `~/.aws/config`
5. ECS container or EC2 instance metadata

With `--aws-profile <name>` (or `MILKSTRAW_AWS_PROFILE`), the SDK skips environment variables and uses the named profile from `~/.aws/config` and `~/.aws/credentials`.


## Auth

Tokens are stored at `~/.config/milkstraw-cli/token`. Login uses the OAuth device code flow via browser.

## Development

```bash
npm install
npm run build
node bin/milkstraw.js --help
```
