import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createDatabase, addProperty, addRow, validateDatabaseSchema, deleteProperty, changePropertyType, deleteSelectOption } from '../src/utils/databaseUtils.ts';
import { updateViewConfig } from '../src/utils/databaseViewUtils.ts';
import { queryRowIds } from '../src/utils/databaseQueryUtils.ts';

let db = createDatabase('Day 14');
db = addProperty(db, { id: 'amount', name: '数量', type: 'number' });
db = addProperty(db, { id: 'status', name: '状态', type: 'select', options: [{ id: 'doing', name: '进行中' }] });
for (let i = 0; i < 200; i++) db = addRow(db, { 'prop-title': `记录 ${i}`, amount: i, status: i % 2 ? 'doing' : null });
const original = db;
db = updateViewConfig(db, { query: {
  filters: [{ id: 'f', propertyId: 'status', propertyType: 'select', operator: 'equals', value: 'doing' }],
  sorts: [{ propertyId: 'amount', propertyType: 'number', direction: 'desc' }],
} });
assert.equal(db.rows, original.rows);
assert.equal(db.rowOrder, original.rowOrder);
assert.equal(validateDatabaseSchema(db), true);
const start = performance.now();
for (let i = 0; i < 100; i++) {
  const ids = queryRowIds(db);
  assert.equal(ids.length, 100);
  assert.equal(db.rows[ids[0]].cells.amount, 199);
  assert.equal(db.rows[ids[99]].cells.amount, 1);
}
const elapsed = performance.now() - start;
assert.ok(elapsed < 2000, `200 行查询 100 次耗时过高: ${elapsed}ms`);
assert.deepEqual(queryRowIds(JSON.parse(JSON.stringify(db))), queryRowIds(db));
for (const current of [deleteProperty(db, 'amount'), changePropertyType(db, 'amount', 'text'), deleteSelectOption(db, 'status', 'doing')]) {
  assert.equal(validateDatabaseSchema(current), true);
  assert.equal(current.rowOrder.length, 200);
}
console.log(`Day14: 200 行 AND 筛选、多重排序、不可变更新、JSON 恢复及字段/选项清理通过；100 次查询 ${elapsed.toFixed(2)}ms`);
