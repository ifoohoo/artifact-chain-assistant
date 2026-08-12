// @feature ACA21
// @scenario S-91
// @decision D-ACA-26
// 入口可发现性确定性合同：三类自然语言意图的关键词集合与 quickstart 确定性路由表。
// 本文件是三入口发现表面的唯一权威事实源；skills-src 三入口 description、catalog.yaml、
// 安装文档与生成适配器副本必须与其保持一致（由 entry-discovery-contract 测试断言）。

export const discoveryIntentClasses = [
  {
    id: 'capability',
    zh: '能力说明',
    en: 'capability overview',
    keywords: {
      zh: ['能做什么', '有哪些能力', '能力说明'],
      en: ['what can', 'capabilities'],
    },
  },
  {
    id: 'onboarding',
    zh: '上手路径',
    en: 'getting-started path',
    keywords: {
      zh: ['怎么上手', '如何开始', '不知道用哪个'],
      en: ['getting started', 'unsure which skill'],
    },
  },
  {
    id: 'artifact-chain-purpose',
    zh: '制品链用途',
    en: 'artifact chain purpose',
    keywords: {
      zh: ['制品链怎么用', '制品链'],
      en: ['artifact chain'],
    },
  },
];

// 确定性路由目标集合：target 是稳定标识，quickstart 路由表与测试共同引用。
export const routingTargets = {
  help: {
    skill: 'help',
    authorizationGate: false,
    summary: '能力说明：展示标准 Family API、bundled legacy 方法和采用步骤',
  },
  setup: {
    skill: 'setup',
    authorizationGate: false,
    summary: '环境诊断：只读环境检查，输出 PASS/WARN/FAIL 状态报告',
  },
  'setup-then-bootstrap': {
    skill: 'artifact-chain-bootstrap',
    authorizationGate: true,
    summary: '写入初始化：先经 setup 只读检查，获得用户明确授权后才进入 bootstrap',
  },
  'where-am-i': {
    skill: 'where-am-i',
    authorizationGate: false,
    summary: '模糊项目任务：搜索项目配置与制品图，输出项目事实和路由建议',
  },
  maintainer: {
    skill: 'artifact-chain-maintainer',
    authorizationGate: false,
    summary: '日常维护：版本锁刷新、hook 管理等维护任务',
  },
  'family-service': {
    skill: null,
    authorizationGate: false,
    summary: '明确制品任务：路由到对应 family/service 专业入口',
  },
  ask: {
    skill: null,
    authorizationGate: false,
    summary: '意图不明确：输出追问而非猜测路由',
  },
};

// 常见中英文自然语言需求的最小覆盖集。phrase 全部小写比较；lang 标注语言。
export const routingVectors = [
  { phrase: '你能做什么', lang: 'zh', target: 'help' },
  { phrase: '这个插件有哪些能力', lang: 'zh', target: 'help' },
  { phrase: '这个项目的制品链怎么用', lang: 'zh', target: 'help' },
  { phrase: 'what can this plugin do', lang: 'en', target: 'help' },
  { phrase: 'how does the artifact chain work', lang: 'en', target: 'help' },
  { phrase: '我的环境准备好了吗', lang: 'zh', target: 'setup' },
  { phrase: '帮我检查一下环境', lang: 'zh', target: 'setup' },
  { phrase: 'is my environment ready', lang: 'en', target: 'setup' },
  { phrase: '帮我初始化这个项目', lang: 'zh', target: 'setup-then-bootstrap' },
  { phrase: '怎么开始使用这个插件', lang: 'zh', target: 'setup-then-bootstrap' },
  { phrase: 'initialize this project', lang: 'en', target: 'setup-then-bootstrap' },
  { phrase: 'how do i get started', lang: 'en', target: 'setup-then-bootstrap' },
  { phrase: '我下一步该做什么', lang: 'zh', target: 'where-am-i' },
  { phrase: '这个项目现在该从哪里入手', lang: 'zh', target: 'where-am-i' },
  { phrase: 'what should i do next', lang: 'en', target: 'where-am-i' },
  { phrase: '帮我刷新版本锁', lang: 'zh', target: 'maintainer' },
  { phrase: 'refresh the version lock', lang: 'en', target: 'maintainer' },
  { phrase: '请审阅这个 PRD feature', lang: 'zh', target: 'family-service' },
  { phrase: 'review this design spec', lang: 'en', target: 'family-service' },
  { phrase: '随便看看', lang: 'zh', target: 'ask' },
  { phrase: 'hello', lang: 'en', target: 'ask' },
];

// 从 quickstart SKILL.md 正文提取确定性路由表 JSON 块。
export function extractRoutingTable(skillMarkdown) {
  const match = skillMarkdown.match(/```json quickstart-routing-table\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// 从 SKILL.md 提取 frontmatter 字段（name/description）。
export function parseFrontmatter(skillMarkdown) {
  const match = skillMarkdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}
