export interface SeedCategory {
  readonly seedKey: string;
  readonly kind: 'income' | 'expense';
  readonly icon: string;
  readonly color: string;
  readonly names: {
    readonly en: string;
    readonly uk: string;
    readonly ru: string;
    readonly pl: string;
  };
}

/**
 * 11 default categories per PRD §4.9.
 * seed_key is stable across locales — allows translation updates without
 * renaming user-created rows.
 */
export const SEED_CATEGORIES: readonly SeedCategory[] = [
  // Income categories
  {
    seedKey: 'income.salary',
    kind: 'income',
    icon: 'briefcase',
    color: '#10B981',
    names: { en: 'Salary', uk: 'Зарплата', ru: 'Зарплата', pl: 'Wynagrodzenie' },
  },
  {
    seedKey: 'income.freelance',
    kind: 'income',
    icon: 'laptop',
    color: '#059669',
    names: { en: 'Freelance', uk: 'Фріланс', ru: 'Фриланс', pl: 'Freelance' },
  },
  {
    seedKey: 'income.other',
    kind: 'income',
    icon: 'plus-circle',
    color: '#6EE7B7',
    names: { en: 'Other income', uk: 'Інші доходи', ru: 'Другие доходы', pl: 'Inne dochody' },
  },
  // Expense categories
  {
    seedKey: 'expense.housing',
    kind: 'expense',
    icon: 'home',
    color: '#6366F1',
    names: { en: 'Housing', uk: 'Житло', ru: 'Жильё', pl: 'Mieszkanie' },
  },
  {
    seedKey: 'expense.food',
    kind: 'expense',
    icon: 'shopping-cart',
    color: '#F59E0B',
    names: {
      en: 'Food & Groceries',
      uk: 'Їжа та продукти',
      ru: 'Еда и продукты',
      pl: 'Jedzenie i zakupy',
    },
  },
  {
    seedKey: 'expense.transport',
    kind: 'expense',
    icon: 'car',
    color: '#3B82F6',
    names: { en: 'Transport', uk: 'Транспорт', ru: 'Транспорт', pl: 'Transport' },
  },
  {
    seedKey: 'expense.health',
    kind: 'expense',
    icon: 'heart',
    color: '#EF4444',
    names: { en: 'Health', uk: 'Здоровʼя', ru: 'Здоровье', pl: 'Zdrowie' },
  },
  {
    seedKey: 'expense.entertainment',
    kind: 'expense',
    icon: 'film',
    color: '#8B5CF6',
    names: { en: 'Entertainment', uk: 'Розваги', ru: 'Развлечения', pl: 'Rozrywка' },
  },
  {
    seedKey: 'expense.subscriptions',
    kind: 'expense',
    icon: 'repeat',
    color: '#EC4899',
    names: { en: 'Subscriptions', uk: 'Підписки', ru: 'Подписки', pl: 'Subskrypcje' },
  },
  {
    seedKey: 'expense.education',
    kind: 'expense',
    icon: 'book',
    color: '#14B8A6',
    names: { en: 'Education', uk: 'Освіта', ru: 'Образование', pl: 'Edukacja' },
  },
  {
    seedKey: 'expense.other',
    kind: 'expense',
    icon: 'tag',
    color: '#6B7280',
    names: { en: 'Other', uk: 'Інше', ru: 'Другое', pl: 'Inne' },
  },
];
