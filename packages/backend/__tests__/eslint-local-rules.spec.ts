import { RuleTester } from 'eslint';
import { createRequire } from 'module';
import { describe, it } from 'vitest';

const require = createRequire(import.meta.url);
const localRules = require('../eslint-local-rules.cjs') as {
  rules: { 'no-repo-without-scope': unknown };
};

const rule = localRules.rules['no-repo-without-scope'];

// Wrap RuleTester.run in a describe so vitest surfaces each case individually.
describe('no-repo-without-scope', () => {
  it('passes valid cases and rejects invalid cases', () => {
    const tester = new RuleTester({
      languageOptions: { ecmaVersion: 2020 },
    });

    tester.run('no-repo-without-scope', rule as never, {
      valid: [
        // Passes scope as identifier containing "scope"
        { code: `planRepository.findById(id, scope)` },
        { code: `planRepository.findById(id, householdScope)` },
        // Passes object with householdId property
        { code: `planRepository.findById(id, { householdId: 'x' })` },
        // Non-scoped write methods are always exempt
        { code: `planRepository.create(plan)` },
        { code: `planRepository.save(plan)` },
        { code: `planRepository.delete(id)` },
        { code: `planRepository.archive(id, new Date())` },
        // Object with householdId on list
        { code: `transactionRepository.list({ householdId: hid })` },
        // Variable name that does NOT end in Repository/Repo — exempt
        { code: `planService.findById(id)` },
      ],
      invalid: [
        {
          code: `planRepository.findById(id)`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `userRepository.list({ page: 1 })`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `transactionRepository.listActive({ userId })`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `transactionRepo.listByPlan(planId)`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `categoryRepo.read(id)`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `userRepository.listByUser(userId)`,
          errors: [{ messageId: 'missingScope' }],
        },
      ],
    });
  });
});
