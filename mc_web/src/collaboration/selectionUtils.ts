/** Map a UTF-16 selection offset through one remote replacement span. */
export function mapTextOffset(before: string, after: string, offset: number) {
  let start = 0, suffix = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (suffix < before.length - start && suffix < after.length - start && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  if (offset < start) return offset;
  if (offset >= before.length - suffix) return Math.max(start, offset + after.length - before.length);
  return after.length - suffix;
}
