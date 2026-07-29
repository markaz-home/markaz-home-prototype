import { describe, expect, it } from 'vitest';
import { clientErrorMessage } from '../trpc';

describe('production tRPC error redaction', () => {
  it('redacts unexpected internal errors in production', () => {
    expect(clientErrorMessage('INTERNAL_SERVER_ERROR', 'database detail', true)).toBe(
      'Internal server error',
    );
  });

  it('preserves intentional public procedure errors', () => {
    expect(clientErrorMessage('BAD_REQUEST', 'ACCOUNT_RESTRICTED', true)).toBe(
      'ACCOUNT_RESTRICTED',
    );
  });

  it('keeps diagnostic messages in local development', () => {
    expect(clientErrorMessage('INTERNAL_SERVER_ERROR', 'local diagnostic', false)).toBe(
      'local diagnostic',
    );
  });
});
