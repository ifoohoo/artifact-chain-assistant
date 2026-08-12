---
id: {DATA_ID}
title: {数据契约名称}
status: draft
version: {v1}
related_features: []
---

# {DATA_ID}: {数据契约名称}

<!-- 本模板是插件 starter 指导，项目本地模板可完全覆盖 -->
<!-- 插件模板是入门指导，项目本地模板是权威 -->

## 概述

{描述这个数据契约的用途、数据来源和消费方}

## 基础信息

- **版本**：{version}
- **数据格式**：JSON / Avro / Protobuf / Parquet
- **生产者**：{数据生产服务}
- **消费者**：{数据消费服务列表}

## 数据模型

### Schema 定义

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "field1": {
      "type": "string",
      "description": "字段描述"
    },
    "field2": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": ["field1"]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 描述 | 约束 |
|------|------|------|------|------|
| field1 | string | 是 | {描述} | max: 255 |
| field2 | integer | 否 | {描述} | min: 0 |

## 数据质量规则

| 规则 | 描述 | 验证方式 |
|------|------|---------|
| 完整性 | {规则描述} | {验证方法} |
| 一致性 | {规则描述} | {验证方法} |
| 时效性 | {规则描述} | {验证方法} |

## 版本兼容性

### 兼容变更

- 添加可选字段
- 放宽字段约束

### 破坏性变更

- 删除字段
- 修改字段类型
- 收紧字段约束

## 数据血缘

{描述数据流转路径和依赖关系}

## 关联制品

- 功能特性：{related_features}
- 设计文档：{related_designs}

## 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| {YYYY-MM-DD} | v1 | 初始版本 | {作者} |
