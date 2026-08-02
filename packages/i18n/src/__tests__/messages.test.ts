import { describe, expect, it } from 'vitest';
import { loadMessages } from '../index';

describe('current product messages', () => {
  it.each(['en', 'ar'])(
    'keeps the %s catalogue free of retired placeholder namespaces',
    (locale) => {
      const messages = loadMessages(locale);

      expect('placeholders' in messages).toBe(false);
      expect('ready' in messages).toBe(false);
    },
  );

  it('describes the implemented simulated publication review', () => {
    const messages = loadMessages('en');

    expect(messages.review.notPublicBody).toContain('simulated publication review');
    expect(messages.review.confirmReview).toContain('simulated publication review');
    expect(messages.review.notPublicBody).not.toContain('later product stage');
  });
});
