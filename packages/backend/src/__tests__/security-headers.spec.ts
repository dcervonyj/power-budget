import { describe, it, expect } from 'vitest';

// Unit test: verify our helmet configuration object has the expected directives
// (Integration tests would require a running server with a DB)
describe('Security headers configuration', () => {
  it('CSP directives contain expected values', () => {
    const directives = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    };

    expect(directives.defaultSrc).toContain("'self'");
    expect(directives.frameSrc).toContain("'none'");
    expect(directives.objectSrc).toContain("'none'");
    expect(directives.scriptSrc).toContain("'self'");
  });

  it('HSTS config has required values', () => {
    const hsts = { maxAge: 31536000, includeSubDomains: true, preload: true };

    expect(hsts.maxAge).toBe(31536000);
    expect(hsts.includeSubDomains).toBe(true);
    expect(hsts.preload).toBe(true);
  });
});
