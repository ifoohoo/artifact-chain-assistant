<!-- @feature ACA27 @scenario S-153 -->

# 制作完整领域正文

先明确项目实际采用的制品类型（feature/scenario/agent_skill/e2e_test等）及其对应原要求来源，识别使用者角色与本轮可观察变更范围，读取完整需求链、场景设计、接口定义、本地模板/checklist，不因目录存在模板而强制采用。类型别名映射规则为：feature → prd-feature, scenario → scenario-script, agent_skill → agent-skill, e2e_test → e2e-test；保持原项目Graph类型/ID不变，不改写或重命名。

需求作者沿 artifact-chain-requirements 路径推进；正式 SPEC 及执行输入由 spec-author 负责生成；功能/场景类制品走现有专业 author 流程，不叠加封装层。

专业 E2E（e2e-test/artifact.e2e-test@1）必须使用项目已绑定的 e2e-test0.2.1 整族 v2 与 service-runner：
- binding 必须由 Registry producer 产生，projectFacts 使用 Registry/Assistant producer 产生且摘要有效的完整 ProjectFactsEvidenceEnvelope；
- 真实 installation/sources 及三个精确 writeSet 必须存在；
- 先执行 preview，再按原合同绑定本地写入；
- 不允许 generic v1 候选、手绕 runner 或未绑定回落；
- 缺真实安装/绑定则暂停该专业项，保留缺口，其他制品继续。

既有项目采用的 legacy e2e 模板流程按原合同执行，不冒称专业 0.2.1 能力，不因新路由改变其公开 ID。

项目 worker 由 checker 解析路径后，由调用方委派 project-worker 执行完整 workflow；不再叠加公共流程。public-worker 仅用于初始化模板与运行 validator；script SUCCEEDED 不代表领域正文完成。

作者必须在目标路径补全模板占位与空段为本项目完整正文，以实际来源组织信息，不补造事实；有未决问题需明确对应影响，不得更改原要求以使稿件“变完整”。

按以下类型方法撰写正文：

- **详细设计 design-spec/design**：给出目标行为与保留行为、正常与风险相关失败场景、输入输出/状态/边界定义、职责与依赖关系、实际算法或处理顺序、错误与恢复机制、兼容/迁移方案与直接验收条件；每个关键决定需可追溯至原要求；接口/治理信息读取真实合同，不复述 PRD 或模板标题。

- **接口 contract/link**：明确调用者/被调用方、数据结构及约束条件、前置/后置状态、错误处理机制、幂等性、重试策略、权限控制、版本兼容性；至少包含正常与失败的具体交互实例；仅适用字段必写，不强制不存在的网络/交易机制。

- **决策 decision**：记录待决问题、约束条件、真实候选方案、取舍依据、最终决定、代价分析、影响范围与兼容性评估、重新评估条件；不将实现现状视为用户批准；不使用 ADR 代替需求文档。

- **技能定义 agent-skill**：明确用户目标与触发条件（何时/不触发）、真实输入输出定义、必要业务顺序、授权边界与完成标准、可恢复空间设计；使用代表性普通任务演示查阅/澄清/纠错能力；故障专项独立处理；工程骨架与规范审计归 Foundation/Audit，不在此处新建控制层替代业务能力。

- **domain/blueprint/verification 与项目自定义类型**：从真实业务对象与本地模板/checklist 出发解释领域职责，对象间关系、规则、反例、可观察完成条件；现有方法不足时报告具体缺口；不编造通用领域算法；不强制复制其他类型结构。

- **测试方案与发布材料**：测试方案与组织沿默认 TEST plan/run；专业测试规格归相应作者；普通人类文档与发布材料按已有表达方式处理；Docs 实际采用与 release 原生职责不变；事实、可读性、公开一致性分别独立判断。

完成正文后，使用 profile 实际 validator 入口验证最终目标，保留输入版本、命令、stdout/stderr、退出码；沿 checker 解析路径与真实命令参数执行，遵守 ARTIFACT_WORKFLOW_TARGET 约定；不再次调用 generate 覆盖已写正文。

按现有协议报告作者及输出，decision NOT_APPLICABLE；不自行 PASS 或接受；交由不同职责按真实类型方法与项目 checklist 独立审阅；发现集中返工后复核影响部分；仅当实际正文与适用审核成立时，方可报告领域完成；无审核则保留未评审状态，不以模板/索引/validator 退出 0 顶替。
