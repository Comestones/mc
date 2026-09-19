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
