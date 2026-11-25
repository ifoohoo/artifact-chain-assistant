<!-- @feature ACA27 @scenario S-152 -->

# 制品作者与审阅者的方法选择

P0 或未迁移路径沿用原公开入口。codex 和 claude-code 的 P1 在制作或审阅任何工作前，必须先按本方法选择实际提供方；其他宿主保持原合同，不扩大 P1 承诺。

## 读取原选择

读取项目现有采用记录与 `agent-methods/project.yaml` 的 entries、overrides、disabled。默认只明确采用 ACA 自带 `agent-methods/catalog.yaml`；测试规划与执行另明确采用用户所选 TEST catalog。不得自动加入其他已安装目录，也不得从派生 effective-index 反推用户意图。

项目自有 Skill 使用项目 entries/overrides；外部插件使用用户明确选择的不同 ref 目录，并在 overlay 禁用原默认 ref。两个业务流读取同一原选择，不能分别维护默认表。

## 严格选择与委派

使用 Registry 0.2.0 公开 `buildEffectiveIndex`、`queryEffectiveIndex`、`resolveEntry` 和 `verifyProvider`。以当前 domain 对应的真实 artifactType 与下节规定的 intent 查询唯一候选，带实际 host、真实 roots 和 `strictProvider:true` 解析。只有 verified 才能调用。

- pluginRoots[provider.plugin] 是实际插件技能目录根列表；projectRoots 是获准项目的真实 Skill 根。不得用笼统包根替代。
- 如果返回的 Skill 与当前入口不同，立即委派该真实 Skill 并停止当前入口，不得继续公共 worker 或原 profile worker。若相同，继续当前类型方法和项目 profile/checklist。
- 默认 `artifact.generate`/`artifact.review` 选择只决定实际作者或审阅者；profile 继续提供领域模板、清单和 validator，不把 profile worker 当作 Registry 提供方。
- 禁用、坏覆盖、缺目录/入口/验证根、多候选或同 ref 冲突均保留具体诊断，不回落默认或公共 worker。无关需求收集和只读查询继续。

## 专有作者与调用点

先读取项目原采用记录、明确选定的 catalogs，以及 `agent-methods/project.yaml` 的 `entries`、`overrides` 与 `disabled`。使用 Registry 0.2.0 的 `buildEffectiveIndex` 构建有效索引，再由 `queryEffectiveIndex` 查询唯一候选，最后用 `resolveEntry` 严格解析。解析时传入实际 `host`、对应提供方的 `pluginRoots`、`projectRoots` 和 `strictProvider:true`，仅 `verified` 后调用。`resolveEntry` 可在内部执行 `verifyProvider`，无需重复验证。`codex` 与 `claude-code` 的 P1 路径采用此规则，P0 或未迁移路径沿用原合同。

四类专有制作使用 `author` 查询，通用制作仍使用 `generate`，审阅仍使用 `review`。查询域为 `domain=artifact`，对应关系如下：
- `requirement / author` → `artifact.requirement.manage`（默认 `artifact-chain-requirements`）
- `spec / author` → `artifact.spec.author`（默认 `spec-author`）
- `prd-feature / author` → `artifact.prd-feature.author`（默认 `prd-feature/author`）
- `scenario-script / author` → `artifact.scenario-script.author`（默认 `scenario-script/author`）

若选中当前 Skill，继续其原专业方法与 profile，不重复委派自身。若选中其他真实 Skill，将原要求、授权边界、项目模板、必要正文与关系上下文完整交接，并立即停止当前默认作者。不得仅记录 `ref` 后继续固定作者、公共 worker 或原 profile worker。

替代提供方完成制作后，仍由原适用独立职责完成完整正文的审阅：包括必要前置、关系链、TEST 规划、SPEC 标记与全文审阅，功能与场景的 `author/review/repair` 闭环保持不变。未评审或未完成状态如实保留，不以 `verified` 代替业务接受。

禁用且无合法替代、坏覆盖、缺目录/入口/验证根、歧义或同 `ref` 冲突时，保留 Registry 原诊断，仅停止依赖作者调用，不回落默认。禁用默认但显式选择不同 `ref` 的合法替代时，仍按唯一查询执行。需求纯收集与只读查询无需 Graph/Registry。专业 E2E 的 v2 整族绑定不变，不扩大专有 `review/repair` 替换范围。
