import type { HttpClient } from '../../infrastructure/api-client/HttpClient.js';
import type { CategoryDto, CreateCategoryDto, UpdateCategoryDto } from '../../contract/dto.js';

export interface ListCategoriesOptions {
  /** Archived categories are left out unless asked for. */
  readonly includeArchived?: boolean;
}

/** The category endpoints (CLN-011), typed with the generated API contract. */
export class CategoriesApi {
  constructor(private readonly http: HttpClient) {}

  async list(options: ListCategoriesOptions = {}): Promise<CategoryDto[]> {
    const url =
      options.includeArchived === true ? '/categories?includeArchived=true' : '/categories';
    const res = await this.http.get<CategoryDto[]>(url);

    return res.data;
  }

  async create(body: CreateCategoryDto): Promise<CategoryDto> {
    const res = await this.http.post<CategoryDto>('/categories', body);

    return res.data;
  }

  async update(categoryId: string, body: UpdateCategoryDto): Promise<CategoryDto> {
    const res = await this.http.patch<CategoryDto>(`/categories/${categoryId}`, body);

    return res.data;
  }
}

/** System categories are seeded for every household and are read-only (403 on PATCH). */
export function isCategoryEditable(category: CategoryDto): boolean {
  return !category.isSystem;
}
