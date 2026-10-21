import { CategoryId } from '@power-budget/core';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { CategoryKind, CategoryView } from '../../../domain/categories/entities.js';
import { CategoryRules, DEFAULT_CATEGORY_PRIVACY } from '../../../domain/categories/entities.js';
import type { CategoryRepository } from '../../../domain/categories/ports.js';
import type { AuditLogger } from '../../../domain/audit/ports.js';

export const DEFAULT_CATEGORY_ICON = 'tag';
export const DEFAULT_CATEGORY_COLOR = '#6B7280';

export interface CreateCategoryInput {
  readonly name: string;
  readonly kind: CategoryKind;
  readonly icon?: string;
  readonly color?: string;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly auditLogger: AuditLogger,
    private readonly generateId: () => string,
  ) {}

  async execute(input: CreateCategoryInput): Promise<CategoryView> {
    const scope = { householdId: input.householdId };
    const name = input.name.trim();
    const existing = await this.categoryRepo.list(scope, { includeArchived: false });
    if (existing.some((category) => CategoryRules.sameName(category.name, name))) {
      throw new Error(`CATEGORY_DUPLICATE: A category named "${name}" already exists`);
    }

    const created = await this.categoryRepo.create({
      id: CategoryId.of(this.generateId()),
      householdId: input.householdId,
      name,
      kind: input.kind,
      icon: input.icon ?? DEFAULT_CATEGORY_ICON,
      color: input.color ?? DEFAULT_CATEGORY_COLOR,
    });

    await this.auditLogger.log({
      householdId: input.householdId,
      actorId: input.userId,
      action: 'CATEGORY_CREATED',
      subjectType: 'Category',
      subjectId: created.id,
      meta: {},
    });

    return { ...created, privacy: DEFAULT_CATEGORY_PRIVACY };
  }
}
