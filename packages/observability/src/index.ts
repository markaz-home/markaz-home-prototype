import pino, { type Logger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Structured application logger (pino).
 *
 * Never log secrets, OTP codes, or access/refresh tokens. The redaction list
 * below is a defence-in-depth backstop, not a substitute for not passing them.
 */
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  base: { service: process.env.SERVICE_NAME ?? 'markaz' },
  redact: {
    paths: [
      'otp',
      'code',
      'token',
      'access_token',
      'refresh_token',
      'password',
      'authorization',
      'cookie',
      '*.otp',
      '*.token',
      '*.access_token',
      '*.refresh_token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[redacted]',
  },
});

/** Create a child logger bound to a request/correlation id. */
export function requestLogger(requestId: string, fields: Record<string, unknown> = {}): Logger {
  return logger.child({ requestId, ...fields });
}

export type { Logger };
