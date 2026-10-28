/** A planned line points at a category that the loaded category list does not contain. */
export class UnknownCategoryError extends Error {
  constructor(readonly categoryId: string) {
    super(`Unknown category ${categoryId}`);
    this.name = 'UnknownCategoryError';
  }
}

/** The name of a category; a category the list lacks is an invalid result, never a blank name. */
export function requireCategoryName(
  names: ReadonlyMap<string, string>,
  categoryId: string,
): string {
  const name = names.get(categoryId);
  if (name === undefined) {
    throw new UnknownCategoryError(categoryId);
  }

  return name;
}
