---
name: scenario-script
description: Use when a user wants to write, review, or repair a scenario-script artifact for an artifact-graph project, routing to the appropriate sub-flow based on intent.
---

# scenario-script

## 目的

为场景剧本制品提供编写、审阅和修复的统一入口。根据用户意图路由到对应的子流程，实现场景剧本从起草到终态的完整闭环。

## 路由决策树

根据用户意图选择进入点：

### 路由到 author

- 用户要求"编写""起草""新建""创建"场景剧本
- 用户提供了业务目标或需求描述，需要从零产出制品
- 项目尚无对应场景剧本，需要初始化

### 路由到 review

- 用户要求"审阅""检查""审查""评估"已有场景剧本
- 用户提供了场景剧本文件路径或 ID
- author 流程完成后的质量验收

### 路由到 repair

- review 产生了 findings 需要修复
- 用户明确要求"修复""修正""改进"某个场景剧本
- 前一轮 review 输出了 repair_entry 建议

## 流程闭环规则

一旦进入子流程，该流程必须自行完成闭环。上层规划器不得另拆 review/repair 步骤：

1. **author 流程**：inspect → compose → validate → review。若 review 产生 findings，进入 repair → re-review 循环，直至终态 verdict（`pass`/`warning`/`BLOCKED`/`NEEDS_INPUT`）。
2. **review 流程**：inspect → review。若存在可修 findings 且非只读模式，进入 repair → re-review 循环直至终态；若只读审阅或用户明确禁止修改，输出 findings 与 repair_entry 后终止，并明确受用户约束。
3. **repair 流程**：基于 review 的 findings 修复 → re-review 确认终态（或 `BLOCKED`/`NEEDS_INPUT`）。

## 输出契约

### 默认入口输出

路由结果必须包含：
- `target_flow`：`author` | `review` | `repair`
- `reason`：路由理由（一句话）
- `artifact_id`：目标制品 ID（若已知）
- `artifact_path`：目标制品路径（若已知）

### 子流程输出

各子流程遵循各自的输出契约，详见：
- `author/SKILL.md`：author 输出契约
- `review/SKILL.md`：review 输出契约（含 machine-readable verdict/findings）
- `repair/SKILL.md`：repair 输出契约（含 re-review 终态）

## 通用质量维度

场景剧本的质量维度是通用的，但具体字段、ID 格式、status 枚举、章节结构必须从目标项目的 artifact-graph.config.yaml、同类制品、项目模板和治理文档中派生：

- **角色与目标**：场景涉及的角色及其目标
- **前置条件**：场景执行前必须满足的条件
- **主路径**：正常流程步骤
- **异常路径**：异常或边界情况的处理
- **可观察结果**：场景完成后的可验证结果
- **需求追溯**：与需求/功能特性制品的关联

## 技能协作边界

- 本技能族只处理场景剧本制品，不处理 PRD 功能特性、设计文档或其他类型
- author 闭环包含 review 步骤，不依赖上层规划器拆出 review
- repair 必须基于 review 的 findings 执行，不凭空修改
- 修复后必须 re-review 确认终态，不跳过终态验证
- 所有项目专属配置（路径、字段、ID pattern、status、章节结构）从目标项目派生，不硬编码
