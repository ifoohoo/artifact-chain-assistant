// @feature ACA21
// @scenario S-91
// @decision D-ACA-26
// @feature ACA23
// @scenario S-96
// @decision D-ACA-30
// @scenario S-87
// @scenario S-88
// @decision D-ACA-31
// 入口可发现性确定性合同：三类自然语言意图的关键词集合与 quickstart 确定性路由表。
// 本文件是三入口发现表面的唯一权威事实源；skills-src 三入口 description、catalog.yaml、
// 安装文档与生成适配器副本必须与其保持一致（由 entry-discovery-contract 测试断言）。
// D-ACA-30：技能名携带 artifact-chain- 前缀，触发语与路由向量全部领域限定，
// 不再响应"你能做什么""怎么开始""hello"等裸全局输入。
// D-ACA-31：setup 是通用安装技能（诊断→计划→询问→授权执行→复验），
// 机械安装步骤由 setup 经用户确认后直接执行；bootstrap 只管项目级配置决策。

export const discoveryIntentClasses = [
  {
    id: 'capability',
    zh: '能力说明',
    en: 'capability overview',
    keywords: {
      zh: ['制品链怎么用', '制品链能力'],
      en: ['artifact chain', 'artifact-chain-assistant'],
    },
  },
  {
    id: 'onboarding',
    zh: '上手路径',
    en: 'getting-started path',
    keywords: {
      zh: ['不知道用哪个', '统一路由入口'],
      en: ['unsure which skill', 'routing'],
    },
  },
  {
    id: 'artifact-chain-purpose',
    zh: '制品链用途',
    en: 'artifact chain purpose',
    keywords: {
      zh: ['制品链', '版本锁'],
      en: ['artifact-graph', 'artifact chain'],
    },
  },
];

// 确定性路由目标集合：target 是稳定标识，quickstart 路由表与测试共同引用。
// skill 字段是宿主全局技能名，必须携带 artifact-chain- 前缀（D-ACA-30）。
export const routingTargets = {
  help: {
    skill: 'artifact-chain-help',
    authorizationGate: false,
    summary: '能力说明：展示标准 Family API、bundled legacy 方法和采用步骤',
  },
  setup: {
    skill: 'artifact-chain-setup',
    authorizationGate: false,
    summary: '环境诊断与授权安装：默认只读检查输出 PASS/WARN/FAIL 报告；机械安装步骤（装 CLI、装 hooks、注入触发块）经用户确认后执行并复验',
  },
  'setup-then-bootstrap': {
    skill: 'artifact-chain-bootstrap',
    authorizationGate: true,
    summary: '项目级配置决策：先经 artifact-chain-setup 诊断与机械安装，制品类型裁剪、config 合同、版本锁决策等需人工判断的事项获得用户明确授权后才进入 bootstrap',
  },
  'where-am-i': {
    skill: 'artifact-chain-where-am-i',
    authorizationGate: false,
    summary: '模糊项目任务：搜索项目配置与制品图，输出项目事实和路由建议',
  },
  requirements: {
    skill: 'artifact-chain-requirements',
    authorizationGate: false,
    summary: '需求池：无配置也能保存、查询和更新需求，并把已选需求承接到增量 SPEC',
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
};

// 常见中英文自然语言需求的最小覆盖集。phrase 全部小写比较；lang 标注语言。
// 所有向量必须携带 artifact-chain/artifact-graph/制品链/版本锁领域限定（D-ACA-30、S-96）；
// 裸全局输入（hello、你能做什么、怎么开始）不在本表范围，本插件不认领。
export const routingVectors = [
  { phrase: '这个项目的制品链怎么用', lang: 'zh', target: 'help' },
  { phrase: 'artifact-chain-assistant 有哪些能力', lang: 'zh', target: 'help' },
  { phrase: 'how does the artifact chain work', lang: 'en', target: 'help' },
  { phrase: 'what can artifact-chain-assistant do', lang: 'en', target: 'help' },
  { phrase: '我的制品链环境准备好了吗', lang: 'zh', target: 'setup' },
  { phrase: '帮我检查 artifact-chain 环境', lang: 'zh', target: 'setup' },
  { phrase: 'is my artifact-chain environment ready', lang: 'en', target: 'setup' },
  { phrase: '帮我初始化这个项目的制品链', lang: 'zh', target: 'setup-then-bootstrap' },
  { phrase: '怎么开始使用 artifact-chain-assistant', lang: 'zh', target: 'setup-then-bootstrap' },
  { phrase: 'initialize the artifact chain for this project', lang: 'en', target: 'setup-then-bootstrap' },
  { phrase: 'how do i get started with artifact-chain', lang: 'en', target: 'setup-then-bootstrap' },
  { phrase: '这个项目的制品链下一步该做什么', lang: 'zh', target: 'where-am-i' },
  { phrase: '这个项目的制品链现在该从哪里入手', lang: 'zh', target: 'where-am-i' },
  { phrase: 'what should i do next with the artifact chain', lang: 'en', target: 'where-am-i' },
  { phrase: '帮我把这些想法保存到制品链需求池', lang: 'zh', target: 'requirements' },
  { phrase: '盘点这个项目的制品链已有能力和证据缺口', lang: 'zh', target: 'where-am-i' },
  { phrase: '更新这条制品链需求的处置和承接位置', lang: 'zh', target: 'requirements' },
  { phrase: '把这些制品链需求承接到本轮迭代 spec', lang: 'zh', target: 'requirements' },
  { phrase: '补齐这个存量项目缺少的制品链制品', lang: 'zh', target: 'where-am-i' },
  { phrase: '按制品链现有契约修复缺陷并保持行为一致', lang: 'zh', target: 'where-am-i' },
  { phrase: '把大型迁移拆成多批可验收 artifact-chain spec', lang: 'zh', target: 'requirements' },
  { phrase: 'capture these ideas in the artifact-chain requirement pool', lang: 'en', target: 'requirements' },
  { phrase: '帮我刷新版本锁', lang: 'zh', target: 'maintainer' },
  { phrase: 'refresh the version lock', lang: 'en', target: 'maintainer' },
  { phrase: '请审阅这个 PRD feature', lang: 'zh', target: 'family-service' },
  { phrase: 'review this design spec', lang: 'en', target: 'family-service' },
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
