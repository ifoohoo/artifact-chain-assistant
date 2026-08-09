---
id: {API_ID}
title: {API 名称}
status: draft
version: {v1}
base_url: {基础 URL}
related_features: []
---

# {API_ID}: {API 名称}

<!-- 本模板是插件 starter 指导，项目本地模板可完全覆盖 -->
<!-- 插件模板是入门指导，项目本地模板是权威 -->

## 概述

{描述这个 API 的用途、范围和主要能力}

## 基础信息

- **版本**：{version}
- **Base URL**：{base_url}
- **协议**：REST / GraphQL / gRPC
- **认证方式**：{认证方式}

## 端点列表

### {METHOD} {路径}

**描述**：{端点描述}

**请求参数**：

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| {param} | {type} | {yes/no} | {描述} |

**请求体**（如适用）：

```json
{
  "field1": "type",
  "field2": "type"
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "field1": "value"
  }
}
```

**错误码**：

| 状态码 | 错误码 | 描述 |
|--------|--------|------|
| 400 | INVALID_PARAM | 参数无效 |
| 401 | UNAUTHORIZED | 未认证 |
| 404 | NOT_FOUND | 资源不存在 |

## 数据模型

### {Model Name}

```json
{
  "id": "string",
  "name": "string",
  "created_at": "datetime"
}
```

## 版本兼容性

{描述版本兼容策略和破坏性变更规则}

## 关联制品

- 功能特性：{related_features}
- 设计文档：{related_designs}
- 决策：{related_decisions}

## 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| {YYYY-MM-DD} | v1 | 初始版本 | {作者} |
