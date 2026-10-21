import type { CategoryId, HouseholdId, UserId } from '@power-budget/core';
import type {
  Category,
  CategoryPatch,
  CategoryPrivacyLevel,
  CategoryView,
} from '../../../domain/categories/entities.js';
import { CategoryRules } from '../../../domain/categories/entities.js';
import type {
  CategoryPrivacyRepository,
  CategoryRepository,
  HouseholdScope,
} from '../../../domain/categories/ports.js';
import type { AuditLogger } from '../../../domain/audit/ports.js';
import { toCategoryViews } from '../category-views.js';

export interface UpdateCategoryChanges extends CategoryPatch {
  readonly privacy?: CategoryPrivacyLevel;
  /** true archives the category, false restores it. */
  readonly archived?: boolean;
}

export interface UpdateCategoryInput {
  readonly categoryId: CategoryId;
  readonly changes: UpdateCategoryChanges;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class UpdateCategoryUseCase {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly privacyRepo: CategoryPrivacyRepository,
    private readonly auditLogger: AuditLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: UpdateCategoryInput): Promise<CategoryView> {
    const scope: HouseholdScope = { householdId: input.householdId };
    const category = await this.categoryRepo.findById(input.categoryId, scope);
    if (category === null) {
      throw new Error(`CATEGORY_NOT_FOUND: Category ${input.categoryId} not found`);
    }
    // The privacy row is keyed by category id only, so a seeded category's
    // privacy would leak across households: system categories are read-only.
    if (CategoryRules.isSystem(category)) {
      throw new Error(`CATEGORY_READ_ONLY: Category ${input.categoryId} is a system category`);
    }

    const { privacy, archived, ...patch } = input.changes;
    await this.assertNameFree(category, patch.name, archived, scope);
    if (Object.keys(patch).length > 0) {
      await this.categoryRepo.update(category.id, patch, scope);
    }
    if (archived !== undefined) {
      await this.categoryRepo.setArchivedAt(category.id, archived ? this.now() : null, scope);
    }
    if (privacy !== undefined) {
      await this.privacyRepo.set(category.id, privacy, input.userId, scope);
    }

    await this.auditLogger.log({
      householdId: input.householdId,
      actorId: input.userId,
      action: 'CATEGORY_UPDATED',
      subjectType: 'Category',
      subjectId: category.id,
      meta: { fields: Object.keys(input.changes) },
    });

    return this.reload(category.id, scope);
  }

  /** A rename, or a restore, must not clash with another active category. */
  private async assertNameFree(
    category: Category,
    newName: string | undefined,
    archived: boolean | undefined,
    scope: HouseholdScope,
  ): Promise<void> {
    const restoring = archived === false && category.archivedAt !== null;
    if (newName === undefined && !restoring) {
      return;
    }
    const name = newName ?? category.name;
    const active = await this.categoryRepo.list(scope, { includeArchived: false });
    const clash = active.some(
      (other) => other.id !== category.id && CategoryRules.sameName(other.name, name),
    );
    if (clash) {
      throw new Error(`CATEGORY_DUPLICATE: A category named "${name.trim()}" already exists`);
    }
  }

  private async reload(id: CategoryId, scope: HouseholdScope): Promise<CategoryView> {
    const [category, privacy] = await Promise.all([
      this.categoryRepo.findById(id, scope),
      this.privacyRepo.listByHousehold(scope),
    ]);
    if (category === null) {
      throw new Error(`CATEGORY_NOT_FOUND: Category ${id} not found`);
    }
    const [view] = toCategoryViews([category], privacy);
    if (view === undefined) {
      throw new Error(`CATEGORY_NOT_FOUND: Category ${id} not found`);
    }

    return view;
  }
}
