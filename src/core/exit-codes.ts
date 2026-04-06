import { CliError } from './errors.js';

export const EXIT_SUCCESS = 0;
export const EXIT_GENERAL = 1;
export const EXIT_USAGE = 2;
export const EXIT_CONFIG = 3;
export const EXIT_AUTH = 4;
export const EXIT_PERMISSION = 5;
export const EXIT_AWS_CREDENTIALS = 6;
export const EXIT_NETWORK = 7;
export const EXIT_RATE_LIMIT = 8;
export const EXIT_BACKEND_VALIDATION = 9;
export const EXIT_AWS_DEPLOYMENT = 10;
export const EXIT_PARTIAL = 11;
export const EXIT_SERVER = 12;

export function exitCodeFromError(error: unknown): number {
  if (error instanceof CliError) {
    return error.exitCode;
  }

  return EXIT_GENERAL;
}
