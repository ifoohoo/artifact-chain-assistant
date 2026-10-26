<!-- @feature ACA27 @scenario S-152 -->

# 制品作者与审阅者的方法选择

P0 或未迁移路径沿用原公开入口。codex 和 claude-code 的 P1 在制作或审阅任何工作前，必须先按本方法选择实际提供方；其他宿主保持原合同，不扩大 P1 承诺。

## 读取原选择

读取项目现有采用记录与 `agent-methods/project.yaml` 的 entries、overrides、disabled。默认只明确采用 ACA 自带 `agent-methods/catalog.yaml`；测试规划与执行另明确采用用户所选 TEST catalog。不得自动加入其他已安装目录，也不得从派生 effective-index 反推用户意图。

项目自有 Skill 使用项目 entries/overrides；外部插件使用用户明确选择的不同 ref 目录，并在 overlay 禁用原默认 ref。两个业务流读取同一原选择，不能分别维护默认表。

## 严格选择与委派

使用 Registry 0.2.0 公开 `buildEffectiveIndex`、`queryEffectiveIndex`、`resolveEntry` 和 `verifyProvider`。以当前 domain 对应的真实 artifactType 与 generate/review intent 查询唯一候选，带实际 host、真实 roots 和 `strictProvider:true` 解析。只有 verified 才能调用。

- pluginRoots[provider.plugin] 是实际插件技能目录根列表；projectRoots 是获准项目的真实 Skill 根。不得用笼统包根替代。
- 如果返回的 Skill 与当前入口不同，立即委派该真实 Skill 并停止当前入口，不得继续公共 worker 或原 profile worker。若相同，继续当前类型方法和项目 profile/checklist。
- 默认 `artifact.generate`/`artifact.review` 选择只决定实际作者或审阅者；profile 继续提供领域模板、清单和 validator，不把 profile worker 当作 Registry 提供方。
- 禁用、坏覆盖、缺目录/入口/验证根、多候选或同 ref 冲突均保留具体诊断，不回落默认或公共 worker。无关需求收集和只读查询继续。

专业 prd-feature、scenario-script 保留现有专业 author/review/repair 闭环；专业 e2e-test 继续严格 v2 绑定，不加入 v1 generic 候选池。需求与 SPEC 使用各自的专有作者及独立审阅入口，不路由成模板复制任务。
