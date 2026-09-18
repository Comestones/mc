import type { DocumentItem } from '../types/document.ts';

/**
 * 递归获取指定页面的所有子孙页面 ID 列表（包含直接子级和深层间接子级）
 */
export function getDescendantPageIds(
  documents: Record<string, DocumentItem>,
  targetId: string
): string[] {
  const result: string[] = [];
  const queue: string[] = [targetId];
  const visited = new Set<string>([targetId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const doc of Object.values(documents)) {
      if (doc.parentId === currentId && !visited.has(doc.id)) {
        visited.add(doc.id);
        result.push(doc.id);
        queue.push(doc.id);
      }
    }
  }

  return result;
}

/**
 * 校验并修复页面树的引用完整性：
 * 1. 清理孤立 parentId（指向不存在的页面）-> 重置为 null（根页面）；
 * 2. 检测并打破父子引用环路（自身成环或间接循环引用）-> 重置为 null。
 */
export function repairPageTree(
  documents: Record<string, DocumentItem>
): Record<string, DocumentItem> {
  const repaired: Record<string, DocumentItem> = {};
  for (const [id, doc] of Object.entries(documents)) {
    repaired[id] = { ...doc };
  }

  for (const [id, doc] of Object.entries(repaired)) {
    if (!doc.parentId) continue;

    // 1. 孤立 parentId 检查：父节点不存在于文档集中
    if (!repaired[doc.parentId]) {
      repaired[id] = { ...doc, parentId: null };
      continue;
    }

    // 2. 环路检查：向上遍历祖先链
    const visitedAncestors = new Set<string>([id]);
    let curr: string | null = doc.parentId;
    let hasCycle = false;

    while (curr) {
      if (visitedAncestors.has(curr)) {
        hasCycle = true;
        break;
      }
      visitedAncestors.add(curr);
      curr = repaired[curr]?.parentId || null;
    }

    if (hasCycle) {
      // 存在环路，重置当前节点 parentId 打破环路
      repaired[id] = { ...doc, parentId: null };
    }
  }

  return repaired;
}

/**
 * 递归级联删除页面及其所有后代页面，确保不产生孤立 parentId，并计算安全的下一激活页
 */
export function cascadeDeletePage(
  documents: Record<string, DocumentItem>,
  targetId: string,
  currentActivePageId: string
): {
  documents: Record<string, DocumentItem>;
  deletedIds: string[];
  nextActivePageId: string;
} {
  const targetDoc = documents[targetId];
  if (!targetDoc) {
    return {
      documents: { ...documents },
      deletedIds: [],
      nextActivePageId: currentActivePageId,
    };
  }

  // 1. 查找所有需删除的 ID（自身 + 全部后代）
  const descendantIds = getDescendantPageIds(documents, targetId);
  const deletedIds = [targetId, ...descendantIds];
  const deleteSet = new Set(deletedIds);

  // 2. 构造过滤后的文档映射
  const nextDocuments: Record<string, DocumentItem> = {};
  for (const [id, doc] of Object.entries(documents)) {
    if (!deleteSet.has(id)) {
      nextDocuments[id] = doc;
    }
  }

  // 3. 计算下一激活页面
  let nextActivePageId = currentActivePageId;
  if (deleteSet.has(currentActivePageId)) {
    // 优先 1：尝试回退到被删目标的原 parentId（若其仍然存在于剩余文档中）
    if (targetDoc.parentId && nextDocuments[targetDoc.parentId]) {
      nextActivePageId = targetDoc.parentId;
    } else {
      // 优先 2：寻找第一个顶级页面
      const remainingTopLevels = Object.values(nextDocuments).filter(
        (doc) => doc.parentId === null
      );
      if (remainingTopLevels.length > 0) {
        nextActivePageId = remainingTopLevels[0].id;
      } else {
        // 优先 3：剩余任意第一个页面，若无则为空
        const remainingKeys = Object.keys(nextDocuments);
        nextActivePageId = remainingKeys[0] || '';
      }
    }
  }

  return {
    documents: nextDocuments,
    deletedIds,
    nextActivePageId,
  };
}
