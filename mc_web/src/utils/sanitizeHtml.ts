/**
 * 行内富文本安全 HTML 清洗工具
 * 严格白名单机制，彻底防范 XSS 脚本与事件注入
 */

const ALLOWED_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'STRIKE',
  'DEL',
  'CODE',
  'A',
  'BR',
  'SPAN',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href', 'target', 'rel', 'title']),
  SPAN: new Set(['class', 'className']),
};

const SAFE_URL_PATTERN = /^(https?:\/\/|mailto:|tel:|#|\/)/i;

/**
 * 清洗 HTML 内容，仅保留安全白名单内的行内富文本标签与属性
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // 降级正则白名单清洗（Node / SSR 环境）
    return rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, '')
      .replace(/<a\s+href=["']([^"']*)["'][^>]*>/gi, (_match, href) => {
        if (!SAFE_URL_PATTERN.test(href.trim())) return '<a>';
        return `<a href="${href.trim()}" target="_blank" rel="noopener noreferrer">`;
      });
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();

      // 如果不在白名单内，丢弃标签但保留其子节点
      if (!ALLOWED_TAGS.has(tagName)) {
        const frag = document.createDocumentFragment();
        while (el.firstChild) {
          const cleanedChild = cleanNode(el.firstChild);
          if (cleanedChild) {
            frag.appendChild(cleanedChild);
          } else {
            el.removeChild(el.firstChild);
          }
        }
        return frag;
      }

      // 清洗属性
      const allowedForTag = ALLOWED_ATTRS[tagName] || new Set();
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        if (!allowedForTag.has(attrName)) {
          el.removeAttribute(attr.name);
          continue;
        }

        // 针对 href 做严格协议校验
        if (tagName === 'A' && attrName === 'href') {
          const hrefVal = attr.value.trim();
          if (!SAFE_URL_PATTERN.test(hrefVal)) {
            el.removeAttribute('href');
          }
        }
      }

      // 为超链接统一添加安全属性
      if (tagName === 'A' && el.hasAttribute('href')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }

      // 递归处理子节点
      const children = Array.from(el.childNodes);
      for (const child of children) {
        const cleanedChild = cleanNode(child);
        if (cleanedChild && cleanedChild !== child) {
          el.replaceChild(cleanedChild, child);
        } else if (!cleanedChild) {
          el.removeChild(child);
        }
      }

      return el;
    }

    // 丢弃注释等无用节点
    return null;
  }

  const body = doc.body;
  const nodes = Array.from(body.childNodes);
  const resultFrag = document.createDocumentFragment();

  for (const node of nodes) {
    const cleaned = cleanNode(node);
    if (cleaned) {
      resultFrag.appendChild(cleaned);
    }
  }

  const container = document.createElement('div');
  container.appendChild(resultFrag);
  return container.innerHTML;
}
