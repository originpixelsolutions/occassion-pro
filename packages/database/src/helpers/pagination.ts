import type { TypedSupabaseClient } from '../client'
import type { PaginatedResult, QueryOptions } from '../types'

/**
 * Apply pagination to a Supabase query
 */
export function applyPagination<T>(
  query: ReturnType<TypedSupabaseClient['from']>,
  options: QueryOptions = {},
) {
  const { page = 1, pageSize = 25, orderBy = 'created_at', orderDirection = 'desc' } = options
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return query
    .order(orderBy, { ascending: orderDirection === 'asc' })
    .range(from, to)
}

/**
 * Build a PaginatedResult from Supabase response
 */
export function buildPaginatedResult<T>(
  data: T[],
  count: number | null,
  options: QueryOptions = {},
): PaginatedResult<T> {
  const { page = 1, pageSize = 25 } = options
  const total = count ?? 0
  const totalPages = Math.ceil(total / pageSize)

  return {
    data,
    count: total,
    page,
    pageSize,
    totalPages,
  }
}

/**
 * Apply full-text search filter
 */
export function applySearch(
  query: ReturnType<TypedSupabaseClient['from']>,
  search: string | undefined,
  column: string = 'name',
) {
  if (!search || search.trim() === '') return query
  return query.ilike(column, `%${search.trim()}%`)
}
