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
        // User-scoped by design
        { code: `this.connectionRepo.listByUser(userId)` },
        // Member receivers (the real call shape in use cases), scoped
        { code: `this.planRepo.findById(id, scope)` },
        { code: `this.transactionRepo.patch(id, patch, { householdId: input.householdId })` },
        { code: `this.mappingRepo.bulkSet(items, by, { householdId })` },
        { code: `this.transferRepo.mark(id, counterpart, by, input.scope)` },
        { code: `deps.planRepository.archive(id, at, this.scope)` },
        // Computed members are not repository calls the rule can reason about
        { code: `this.repos[name].findById(id)` },
        // Repositories exempted through the option
        {
          code: `this.userRepo.findById(userId)`,
          options: [{ unscopedRepositories: ['^userRepo$'] }],
        },
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
        // Audit H9: member receivers were ignored, so every real call passed unchecked
        {
          code: `this.planRepo.findById(id)`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `this.transactionRepo.patch(id, patch)`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `this.mappingRepo.bulkSet(items, by)`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `this.transferRepo.mark(id, counterpart, by)`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `this.connectionRepo.markDisconnected(id, at)`,
          errors: [{ messageId: 'missingScope' }],
        },
        {
          code: `this.planRepository.archive(id, at, { userId })`,
          errors: [{ messageId: 'missingScope' }],
        },
        // The option exempts only matching receivers
        {
          code: `this.planRepo.findById(id)`,
          options: [{ unscopedRepositories: ['^userRepo$'] }],
          errors: [{ messageId: 'missingScope' }],
        },
      ],
    });
  });
});
