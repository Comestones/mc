import type { DatabaseFilter, DatabaseProperty, DatabaseQuery, DatabaseRow, DatabaseSchema, FilterOperator, PropertyType } from '../types/database.ts';

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: '等于', notEquals: '不等于', contains: '包含', notContains: '不包含',
  gt: '大于 / 晚于', gte: '大于等于 / 不早于', lt: '小于 / 早于', lte: '小于等于 / 不晚于',
  isEmpty: '为空', isNotEmpty: '不为空',
};
export function filterOperators(type: PropertyType): FilterOperator[] {
  const empty: FilterOperator[] = ['isEmpty', 'isNotEmpty'];
  if (type === 'multiSelect') return ['contains', 'notContains', ...empty];
  if (type === 'checkbox' || type === 'select') return ['equals', 'notEquals', ...empty];
  if (type === 'number' || type === 'date' || type === 'createdTime') return ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', ...empty];
  return ['contains', 'notContains', 'equals', 'notEquals', ...empty];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function validQueryDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  return year > 0 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
type QuerySchema = Pick<DatabaseSchema, 'properties' | 'propertyOrder'>;
/** Keep typed drafts (null value), discard stale fields/types/options and corrupt rules. */
export function normalizeQuery(database: QuerySchema, value: unknown): DatabaseQuery {
  const input = record(value);
  const filterIds = new Set<string>();
  const filters: DatabaseFilter[] = [];
  for (const raw of Array.isArray(input.filters) ? input.filters : []) {
    const rule = record(raw);
    const property = typeof rule.propertyId === 'string' && database.propertyOrder.includes(rule.propertyId) ? database.properties[rule.propertyId] : undefined;
    if (!property || rule.propertyType !== property.type || typeof rule.id !== 'string' || !rule.id || filterIds.has(rule.id)
      || !filterOperators(property.type).includes(rule.operator as FilterOperator)) continue;
    const operator = rule.operator as FilterOperator;
    const unary = operator === 'isEmpty' || operator === 'isNotEmpty';
    const val = unary ? null : rule.value;
    if (!unary && val !== null) {
      if (property.type === 'number' ? typeof val !== 'number' || !Number.isFinite(val)
        : property.type === 'checkbox' ? typeof val !== 'boolean'
        : property.type === 'date' || property.type === 'createdTime' ? !validQueryDate(val)
        : typeof val !== 'string') continue;
      if ((property.type === 'select' || property.type === 'multiSelect') && !property.options?.some(option => option.id === val)) continue;
    }
    filterIds.add(rule.id);
    filters.push({ id: rule.id, propertyId: property.id, propertyType: property.type, operator, value: val as DatabaseFilter['value'] });
  }
  const sortIds = new Set<string>();
  const sorts: DatabaseQuery['sorts'] = [];
  for (const raw of Array.isArray(input.sorts) ? input.sorts : []) {
    const rule = record(raw);
    const property = typeof rule.propertyId === 'string' && database.propertyOrder.includes(rule.propertyId) ? database.properties[rule.propertyId] : undefined;
    if (!property || property.type !== rule.propertyType || sortIds.has(property.id) || (rule.direction !== 'asc' && rule.direction !== 'desc')) continue;
    sortIds.add(property.id);
    sorts.push({ propertyId: property.id, propertyType: property.type, direction: rule.direction });
  }
  return { filters, sorts };
}
export function validateQuery(database: QuerySchema, value: unknown): boolean {
  const input = record(value);
  const normalized = normalizeQuery(database, value);
  return Array.isArray(input.filters) && Array.isArray(input.sorts)
    && input.filters.length === normalized.filters.length && input.sorts.length === normalized.sorts.length
    && input.filters.every((raw, index) => {
      const rule = record(raw), next = normalized.filters[index];
      return rule.id === next.id && rule.propertyId === next.propertyId && rule.propertyType === next.propertyType && rule.operator === next.operator && rule.value === next.value;
    }) && input.sorts.every((raw, index) => {
      const rule = record(raw), next = normalized.sorts[index];
      return rule.propertyId === next.propertyId && rule.propertyType === next.propertyType && rule.direction === next.direction;
    });
}
export function isActiveFilter(filter: DatabaseFilter): boolean {
  return filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty' || (filter.value !== null && filter.value !== '');
}
function cellValue(property: DatabaseProperty, row: DatabaseRow) {
  // An unset checkbox has the same unchecked meaning in every view.
  return property.type === 'createdTime' ? row.createdAt : property.type === 'checkbox' ? row.cells[property.id] === true : row.cells[property.id];
}
const isEmpty = (value: unknown) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
function calendarDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function matches(property: DatabaseProperty, row: DatabaseRow, filter: DatabaseFilter): boolean {
  let value = cellValue(property, row);
  if (filter.operator === 'isEmpty') return isEmpty(value);
  if (filter.operator === 'isNotEmpty') return !isEmpty(value);
  if (isEmpty(value)) return false;
  if (property.type === 'createdTime') value = calendarDate(row.createdAt);
  const expected = filter.value;
  const left = typeof value === 'string' && property.type !== 'select' ? value.toLocaleLowerCase() : value;
  const right = typeof expected === 'string' && property.type !== 'select' && property.type !== 'multiSelect' ? expected.toLocaleLowerCase() : expected;
  switch (filter.operator) {
    case 'equals': return left === right;
    case 'notEquals': return left !== right;
    case 'contains': return Array.isArray(left) ? left.includes(String(right)) : String(left).includes(String(right));
    case 'notContains': return Array.isArray(left) ? !left.includes(String(right)) : !String(left).includes(String(right));
    case 'gt': return (left as number | string) > (right as number | string);
    case 'gte': return (left as number | string) >= (right as number | string);
    case 'lt': return (left as number | string) < (right as number | string);
    case 'lte': return (left as number | string) <= (right as number | string);
  }
}
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
function sortValue(property: DatabaseProperty, row: DatabaseRow): string | number | boolean | null | undefined {
  const value = cellValue(property, row);
  if (isEmpty(value)) return null;
  if (property.type === 'select') return property.options?.find(option => option.id === value)?.name ?? null;
  if (property.type === 'multiSelect') return (value as string[]).map(id => property.options?.find(option => option.id === id)?.name ?? '').sort(collator.compare).join('、');
  return value as string | number | boolean;
}
/** Immutable shared pipeline. Nulls last in both directions; stable ties retain rowOrder. */
export function queryRowIds(database: DatabaseSchema): string[] {
  const query = normalizeQuery(database, database.viewConfig?.query);
  const filters = query.filters.filter(isActiveFilter);
  const rows = database.rowOrder.filter(id => database.rows[id] && filters.every(filter => matches(database.properties[filter.propertyId], database.rows[id], filter)));
  if (!query.sorts.length) return rows;
  const keys = new Map(rows.map(id => [id, query.sorts.map(sort => sortValue(database.properties[sort.propertyId], database.rows[id]))]));
  return rows.sort((a, b) => {
    for (let index = 0; index < query.sorts.length; index++) {
      const left = keys.get(a)![index], right = keys.get(b)![index];
      if (isEmpty(left) || isEmpty(right)) {
        if (isEmpty(left) !== isEmpty(right)) return isEmpty(left) ? 1 : -1;
        continue;
      }
      const compared = typeof left === 'number' && typeof right === 'number' ? left - right
        : typeof left === 'boolean' && typeof right === 'boolean' ? Number(left) - Number(right) : collator.compare(String(left), String(right));
      if (compared) return query.sorts[index].direction === 'asc' ? compared : -compared;
    }
    return 0;
  });
}
