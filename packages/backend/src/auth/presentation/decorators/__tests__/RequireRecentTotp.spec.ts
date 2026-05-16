import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { RequireRecentTotp, REQUIRE_RECENT_TOTP_KEY } from '../RequireRecentTotp.js';

describe('RequireRecentTotp decorator', () => {
  it('sets REQUIRE_RECENT_TOTP metadata to default 5 minutes', () => {
    class TestClass {
      @RequireRecentTotp()
      method() {}
    }

    const reflector = new Reflector();
    const minutes = reflector.get(REQUIRE_RECENT_TOTP_KEY, TestClass.prototype.method);
    expect(minutes).toBe(5);
  });

  it('sets REQUIRE_RECENT_TOTP metadata to custom minutes value', () => {
    class TestClass {
      @RequireRecentTotp(10)
      method() {}
    }

    const reflector = new Reflector();
    const minutes = reflector.get(REQUIRE_RECENT_TOTP_KEY, TestClass.prototype.method);
    expect(minutes).toBe(10);
  });
});
