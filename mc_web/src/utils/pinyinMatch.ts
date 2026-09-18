/**
 * 拼音与英文模糊检索匹配工具
 * 为斜杠指令 (Slash Command) 提供秒级零依赖过滤能力
 */

export interface PinyinMeta {
  full: string[];      // 全拼列表，如 ['daima', 'daimakuai']
  initials: string[];  // 拼音首字母列表，如 ['dm', 'dmk']
}

/**
 * 块类型中文拼音字典元数据
 */
export const BLOCK_PINYIN_MAP: Record<string, PinyinMeta> = {
  paragraph: {
    full: ['zhengwen', 'duanluo', 'putong'],
    initials: ['zw', 'dl', 'pt'],
  },
  heading1: {
    full: ['yijibiaoti', 'biaoti1', 'dabiaoti'],
    initials: ['yjbt', 'bt1', 'dbt'],
  },
  heading2: {
    full: ['erjibiaoti', 'biaoti2', 'zhongbiaoti'],
    initials: ['ejbt', 'bt2', 'zbt'],
  },
  heading3: {
    full: ['sanjibiaoti', 'biaoti3', 'xiaobiaoti'],
    initials: ['sjbt', 'bt3', 'xbt'],
  },
  bulletList: {
    full: ['wuxuliebiao', 'xiangmufuhao', 'liebiao', 'dian'],
    initials: ['wxlb', 'xmfh', 'lb', 'd'],
  },
  numberedList: {
    full: ['youxuliebiao', 'shuziliebiao', 'xuhao'],
    initials: ['yxlb', 'szlb', 'xh'],
  },
  todo: {
    full: ['daibanqingdan', 'renwubang', 'daiban', 'gouxuan'],
    initials: ['dbqd', 'rwb', 'db', 'gx'],
  },
  code: {
    full: ['daimakuai', 'daima', 'chengxuma'],
    initials: ['dmk', 'dm', 'cxm'],
  },
  quote: {
    full: ['yinyongkuai', 'yinyong', 'shuminghao'],
    initials: ['yyk', 'yy', 'smh'],
  },
  callout: {
    full: ['tishikuai', 'tishi', 'gaoliang', 'jinggao'],
    initials: ['tsk', 'ts', 'gl', 'jg'],
  },
  database: {
    full: ['duoweishujuku', 'shujuku', 'biaoge', 'duowei'],
    initials: ['dwsjk', 'sjk', 'bg', 'dw'],
  },
  divider: {
    full: ['fengexian', 'fenge', 'hengxian'],
    initials: ['fgx', 'fg', 'hx'],
  },
};

/**
 * 判断指定候选项目是否匹配检索词
 * 匹配策略：
 * 1. 检索词为空时恒匹配
 * 2. 中文名称或描述包含 query
 * 3. 英文指令关键词匹配（包含或前缀匹配）
 * 4. 拼音首字母缩写匹配（如 'dm' 匹配代码块，'bt' 匹配标题）
 * 5. 全拼包含或前缀匹配（如 'daima' 匹配代码块，'biaoti' 匹配标题）
 */
export function matchPinyinOrEnglish(
  query: string,
  label: string,
  description: string,
  keywords: string[],
  pinyinMeta?: PinyinMeta
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // 1. 中文 Label / Description 包含
  if (label.toLowerCase().includes(q) || description.toLowerCase().includes(q)) {
    return true;
  }

  // 2. 英文关键词匹配
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (kwLower.startsWith(q) || kwLower.includes(q)) {
      return true;
    }
  }

  // 3. 拼音匹配
  if (pinyinMeta) {
    // 3a. 拼音首字母前缀或包含匹配
    for (const init of pinyinMeta.initials) {
      if (init.startsWith(q) || init.includes(q)) {
        return true;
      }
    }

    // 3b. 拼音全拼前缀或包含匹配
    for (const full of pinyinMeta.full) {
      if (full.startsWith(q) || full.includes(q)) {
        return true;
      }
    }
  }

  return false;
}
