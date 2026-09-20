/**
 * 多维数据库属性类型枚举定义
 */
export const VALID_PROPERTY_TYPES = [
  'title',       // 唯一标题列（主键名称）
  'text',        // 普通文本
  'number',      // 数字
  'select',      // 单选标签
  'multiSelect', // 多选标签
  'checkbox',    // 勾选框
  'date',        // 日期
  'url',         // 超链接
] as const;

export type PropertyType = (typeof VALID_PROPERTY_TYPES)[number];

/**
 * 表格列宽边界约束常量
 */
export const MIN_COLUMN_WIDTH = 120;
export const MAX_COLUMN_WIDTH = 600;
export const DEFAULT_COLUMN_WIDTH = 180;

/**
 * 标签选项定义（适用于 select 和 multiSelect）
 */
export interface SelectOption {
  id: string;
  name: string;
  color?: string;
}

/**
 * 预设标签色彩体系（8 款经典类 Notion 柔和对比色）
 */
export const PRESET_OPTION_COLORS = [
  { id: 'gray', label: '灰色', color: '#6b7280', bg: '#f3f4f6', darkBg: '#374151', text: '#374151', darkText: '#f3f4f6' },
  { id: 'blue', label: '蓝色', color: '#3b82f6', bg: '#eff6ff', darkBg: '#1e3a8a', text: '#1d4ed8', darkText: '#bfdbfe' },
  { id: 'green', label: '绿色', color: '#10b981', bg: '#ecfdf5', darkBg: '#064e3b', text: '#047857', darkText: '#a7f3d0' },
  { id: 'yellow', label: '黄色', color: '#f59e0b', bg: '#fefce8', darkBg: '#78350f', text: '#b45309', darkText: '#fde68a' },
  { id: 'red', label: '红色', color: '#ef4444', bg: '#fef2f2', darkBg: '#7f1d1d', text: '#b91c1c', darkText: '#fecaca' },
  { id: 'purple', label: '紫色', color: '#8b5cf6', bg: '#faf5ff', darkBg: '#581c87', text: '#6d28d9', darkText: '#ddd6fe' },
  { id: 'pink', label: '粉色', color: '#ec4899', bg: '#fdf2f8', darkBg: '#831843', text: '#be185d', darkText: '#fbcfe8' },
  { id: 'orange', label: '橙色', color: '#f97316', bg: '#fff7ed', darkBg: '#7c2d12', text: '#c2410c', darkText: '#fed7aa' },
] as const;

/**
 * 数据库元信息更新类型（限制 updateDatabase 仅可更新元信息，禁止绕过 CRUD 篡改结构）
 */
export type DatabaseMetaUpdates = Partial<
  Pick<DatabaseSchema, 'title' | 'icon' | 'description'>
>;

/**
 * 数据库列属性定义
 */
export interface DatabaseProperty {
  id: string;
  name: string;
  type: PropertyType;
  options?: SelectOption[];
  width?: number; // 默认列宽 (px)
}

/**
 * 单元格值类型联合
 */
export type CellValue =
  | string
  | number
  | boolean
  | string[] // multiSelect 存储 optionId 列表或标签名称
  | null
  | undefined;

/**
 * 单元格实体定义
 */
export interface DatabaseCell {
  propertyId: string;
  value: CellValue;
}

/**
 * 数据库行记录实体定义
 */
export interface DatabaseRow {
  id: string;
  databaseId: string;
  cells: Record<string, CellValue>;
  createdAt: number;
  updatedAt: number;
}

/**
 * 多维数据库整体 Schema 契约
 */
export interface DatabaseSchema {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  properties: Record<string, DatabaseProperty>;
  propertyOrder: string[]; // 属性列展示次序
  rows: Record<string, DatabaseRow>;
  rowOrder: string[]; // 行记录展示次序
  createdAt: number;
  updatedAt: number;
}
