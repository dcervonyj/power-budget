import { describe, expect, it } from 'vitest';
import { containsPattern } from '../likePattern.js';

describe('containsPattern (audit L4)', () => {
  it('wraps plain text in wildcards', () => {
    expect(containsPattern('coffee')).toBe('%coffee%');
  });

  it('escapes LIKE wildcards and the escape character', () => {
    expect(containsPattern('50%_off\\now')).toBe('%50\\%\\_off\\\\now%');
  });
});
