export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export class UsageError extends CliError {
  constructor(message: string) {
    super(message, 2);
    this.name = 'UsageError';
  }
}

export class ConfigError extends CliError {
  constructor(message: string) {
    super(message, 3);
    this.name = 'ConfigError';
  }
}

export class AuthRequiredError extends CliError {
  constructor(message = 'Authentication required. Run: milkstraw login') {
    super(message, 4);
    this.name = 'AuthRequiredError';
  }
}

export class PermissionError extends CliError {
  public readonly organizationId?: string;
  public readonly organizationName?: string;

  constructor(message: string, options?: { organizationId?: string; organizationName?: string }) {
    super(message, 5);
    this.name = 'PermissionError';
    this.organizationId = options?.organizationId;
    this.organizationName = options?.organizationName;
  }
}

export class AwsCredentialsError extends CliError {
  constructor(message: string) {
    super(message, 6);
    this.name = 'AwsCredentialsError';
  }
}

export class NetworkError extends CliError {
  constructor(message = 'Unable to connect to MilkStraw API. Check your internet connection and try again.') {
    super(message, 7);
    this.name = 'NetworkError';
  }
}

export class ServerError extends CliError {
  public readonly statusCode: number;

  constructor(statusCode: number, message = 'MilkStraw API is experiencing issues. Try again later.') {
    super(message, 12);
    this.name = 'ServerError';
    this.statusCode = statusCode;
  }
}

export class RateLimitError extends CliError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limited. Please try again later.', retryAfter?: number) {
    super(message, 8);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class BackendValidationError extends CliError {
  public readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message, 9);
    this.name = 'BackendValidationError';
    this.errorCode = errorCode;
  }
}

export class AwsDeploymentError extends CliError {
  constructor(message: string) {
    super(message, 10);
    this.name = 'AwsDeploymentError';
  }
}

export class PartialSuccessError extends CliError {
  public readonly succeeded: number;
  public readonly failed: number;

  constructor(message: string, succeeded: number, failed: number) {
    super(message, 11);
    this.name = 'PartialSuccessError';
    this.succeeded = succeeded;
    this.failed = failed;
  }
}
