# Agent Method Registry（代理方法注册表）

[English](AGENT-METHOD-REGISTRY.md)

插件内置了确定性的 agent-method-registry 集成，提供目录解析、provider 验证和 CLI 诊断。

## 默认目录

默认目录位于 `<plugin-root>/agent-methods/catalog.yaml`，注册了 **13 个 workflow 入口**：
`prd-feature` 和 `scenario-script` 两个技能族的 8 个专业入口，加上 review、repair、
batch、audit、generate 五个通用入口。通用入口不含 PRD/场景类型，因此每个受支持的
type+intent 查询都唯一命中。

目录还包含 3 个 `kind: operation` 条目（`artifact.help`、`artifact.setup`、
`artifact.quickstart`），用于只读发现和诊断；它们不是 workflow 入口，下表省略。

| Ref | 技能族 | 入口 |
|-----|--------|------|
| `artifact.prd-feature.default` | prd-feature | 默认路由入口 |
| `artifact.prd-feature.author` | prd-feature | 编写 |
| `artifact.prd-feature.review` | prd-feature | 审阅 |
| `artifact.prd-feature.repair` | prd-feature | 修复 |
| `artifact.scenario-script.default` | scenario-script | 默认路由入口 |
| `artifact.scenario-script.author` | scenario-script | 编写 |
| `artifact.scenario-script.review` | scenario-script | 审阅 |
| `artifact.scenario-script.repair` | scenario-script | 修复 |
| `artifact.review` | artifact-review | 审阅 |
| `artifact.repair` | artifact-repair | 修复 |
| `artifact.batch` | artifact-batch | 批处理 |
| `artifact.audit` | artifact-audit | 审计 / health |
| `artifact.generate` | artifact-generate | 生成 |

## 单独安装

只需要注册表能力时，可以单独安装 `agent-method-registry@0.2.0`：

```bash
npm install agent-method-registry@0.2.0
```

安装后即可使用 `agent-method-registry` CLI。

## v1 覆盖层与 v2 绑定

Registry 0.2.0 同时公开两套输入，调用方必须按版本分别传递：

- v1 使用 catalog 与可选的 `ProjectOverlayData`。项目覆盖源通常是
  `agent-methods/project.yaml`，其中 `overrides[ref]`、`entries` 和 `disabled` 参与 v1
  有效索引构建。它不是 v2 binding。
- v2 使用调用方显式选择并解析的原始 `BindingData` 文档。该文档包含 `bindings`，也可以
  包含 `serviceBindings`。调用方把完整文档作为 `bindings` 参数传给包根公开函数，而不是
  把某条覆盖项或内部 worker 改写成 binding。

v2 的最小公开调用关系如下。`familyApi`、`implementations`、`inventory`、`bindings` 和
`methodQueryCandidate` 都由调用方从各自权威输入读取或构建：

```js
import { buildEffectiveIndex, queryEffectiveIndex } from 'agent-method-registry';

const built = buildEffectiveIndex({
  familyApi,
  implementations,
  inventory,
  bindings,
});
if (!built.ok || !built.index) throw new Error('Registry v2 index build failed');

const recommendation = queryEffectiveIndex({
  index: built.index,
  methodQueryCandidate,
  purpose: 'recommendation',
});
```

制品入口消费 recommendation 时，保存绑定源引用和服务身份 `serviceId`、`apiId`、
`apiMajor`、`apiRevisionDigest`，并直接使用 Registry 返回的 `executable`、`installation`、
`enablement`、`compatibility`、`trust`、`resolution` 与 `selectionSource`。不要把
`familyImplementationId`、`serviceImplementationId` 或 provider 路径复制到图配置、
workflow profile 或制品正文。项目内部 worker 不是 Registry binding；文档中的来源路径
也不会自动变成发现协议，调用方仍须显式选择并读取绑定输入。

## 构建 v1 有效索引

以下 CLI 示例属于 v1：有效索引由目录加上可选的项目覆盖层构建。首先通过宿主 CLI 定位已安装的插件根目录。
**不要**使用 `require.resolve`——marketplace 安装不会把插件放进目标项目的 `node_modules`。

**Codex**——使用 `codex plugin list --json` 和 `CODEX_HOME` 缓存布局：

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PLUGIN_ROOT=$(codex plugin list --json 2>/dev/null \
  | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const data=JSON.parse(d);
      const p=data.installed.find(x=>x.pluginId==='artifact-chain-assistant@artifact-skill-set');
      if(!p||!p.installed||!p.enabled||!p.marketplaceName||!p.name||!p.version){process.stderr.write('artifact-chain-assistant record incomplete\n');process.exit(1);}
      console.log(require('path').join(process.env.CODEX_HOME,'plugins','cache',p.marketplaceName,p.name,p.version));
    });
  ")
[ -f "$PLUGIN_ROOT/agent-methods/catalog.yaml" ] || { echo "catalog not found at $PLUGIN_ROOT"; exit 1; }
```

**Claude Code**——使用 `claude plugin list --json` 和 `installPath`：

```bash
PLUGIN_ROOT=$(claude plugin list --json 2>/dev/null \
  | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const p=JSON.parse(d).find(x=>x.id==='artifact-chain-assistant@artifact-skill-set');
      if(!p||!p.enabled||!p.installPath){process.stderr.write('artifact-chain-assistant not found, not enabled, or installPath missing\n');process.exit(1);}
      console.log(p.installPath);
    });
  ")
[ -f "$PLUGIN_ROOT/agent-methods/catalog.yaml" ] || { echo "catalog not found at $PLUGIN_ROOT"; exit 1; }
```

> 仅限 monorepo 开发时，源码检出的插件根目录为 `plugins/artifact-chain-assistant`。
> 市场用户必须使用上述宿主 CLI 发现方式。

定位 `PLUGIN_ROOT` 后，运行通用工作流前先验证目标项目（只读）：

```bash
node "$PLUGIN_ROOT/scripts/check-workflow-profile.mjs" \
  --root . --action review --domain design-spec --format json
```

退出码 0 表示所需的项目标记和 worker 映射均存在。退出码 2 返回 `NEEDS_INPUT`；
请补充缺失的项目 profile 或 worker，而非声称工作流已成功。

批量操作使用同一插件根目录下的切分和合并脚本：

```bash
# 切分制品为批次（JSON 数组输出到 stdout）
node "$PLUGIN_ROOT/scripts/batch-split.mjs" ./artifacts/design --batch-size 40000

# 从结果目录合并批次结果（合并后的 JSON 输出到 stdout）
node "$PLUGIN_ROOT/scripts/batch-merge.mjs" ./batch-results --run-id my-run
```

然后构建索引：

```bash
# 仅目录（无项目 provider）
agent-method-registry index \
  --catalog "$PLUGIN_ROOT/agent-methods/catalog.yaml" \
  --out .agent-method-registry/effective-index.json
```

项目没有 provider 文件时，注册表**不会**创建空的覆盖层文件，只根据目录构建有效索引。
只有项目定义了覆盖或禁用项时才需要 `--project` 参数：

```bash
# 目录 + 项目覆盖层
agent-method-registry index \
  --catalog "$PLUGIN_ROOT/agent-methods/catalog.yaml" \
  --project agent-methods/project.yaml \
  --out .agent-method-registry/effective-index.json
```

## 项目级覆盖

目标项目有自己的完整入口定义时，在项目根目录放置 `agent-methods/project.yaml`。
例如把默认的 `prd-feature` 路由入口覆盖为项目本地技能：

```yaml
schemaVersion: 1
overrides:
  artifact.prd-feature.default:
    provider:
      scope: project
      skill: prd-feature
```

项目覆盖层还可以通过 `entries` 添加新入口、通过 `disabled` 禁用插件入口。

## 有效索引是生成缓存

v1 的 `.agent-method-registry/effective-index.json` 是**生成的构建产物**，不是事实来源，
由 `catalog.yaml` 加上可选的 `project.yaml` 覆盖层派生而来。v2 index 同样只能从
Family API、实现目录、inventory 和原始 binding 输入通过 Registry 公开入口构建，不能手写。

- 不要手工编辑。
- 目录或项目覆盖层变更后要重新构建。
- 除非项目明确选择提交，否则不要纳入版本控制。

## 面向规划器的紧凑查询

用 `--format compact` 获取规划所需的最小视图。紧凑查询只返回 `ref`、`kind` 和
`summary`，规划器据此选定入口即可，无需加载完整元数据；选定后再用 `resolve` 获取
provider 路径：

```bash
# 紧凑查询：规划器只看到 ref/kind/summary
agent-method-registry query \
  --index .agent-method-registry/effective-index.json \
  --domain artifact --artifact-type prd-feature \
  --kind workflow --format compact

# 选定后解析：获取完整提供者路径
agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host claude-code \
  --plugin-root "$PLUGIN_ROOT/skills"
```

## 闭环 workflow 入口

8 个专业入口的 `kind` 均为 `workflow`。`workflow` 入口是**闭环叶子**：进入后自行完成
inspect、compose、review、validate、repair 整个循环，外层规划器不要再为它安排独立的
review 或 repair 步骤。

## Registry 不可用时的 fallback 行为

`agent-method-registry` 未安装、有效索引不存在或所需 binding 缺失时，`artifact-chain-where-am-i` 按以下方式回退：

1. 输出 `"registry unavailable"` 诊断信息。
2. 对于有契约支撑的动态专业服务，返回 `NEEDS_INPUT` 并附带缺失信息——**不会回落到内置或配置路由**。
3. 静态 help、普通图查询、无契约支撑的通用条目和已有固定直调入口继续按各自合同工作。
4. **不会**尝试手工合并目录，也不会创建空的有效索引。

## 定位插件根目录

用宿主 CLI 查找已安装的插件根目录。**不要**使用 `require.resolve`——marketplace 安装
不会把插件放进目标项目的 `node_modules`。

**Codex**：

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PLUGIN_ROOT=$(codex plugin list --json 2>/dev/null \
  | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const data=JSON.parse(d);
      const p=data.installed.find(x=>x.pluginId==='artifact-chain-assistant@artifact-skill-set');
      if(!p||!p.installed||!p.enabled||!p.marketplaceName||!p.name||!p.version){process.stderr.write('plugin record incomplete\n');process.exit(1);}
      console.log(require('path').join(process.env.CODEX_HOME,'plugins','cache',p.marketplaceName,p.name,p.version));
    });
  ")
```

**Claude Code**：

```bash
PLUGIN_ROOT=$(claude plugin list --json 2>/dev/null \
  | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const p=JSON.parse(d).find(x=>x.id==='artifact-chain-assistant@artifact-skill-set');
      if(!p||!p.enabled||!p.installPath){process.stderr.write('plugin not found, not enabled, or installPath missing\n');process.exit(1);}
      console.log(p.installPath);
    });
  ")
```

然后在 resolve 命令中使用：

```bash
agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host codex \
  --plugin-root "$PLUGIN_ROOT/skills"

agent-method-registry resolve \
  --index .agent-method-registry/effective-index.json \
  --ref artifact.prd-feature.author \
  --host claude-code \
  --plugin-root "$PLUGIN_ROOT/skills"
```
