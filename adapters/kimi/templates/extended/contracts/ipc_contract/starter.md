---
id: {IPC_ID}
title: {IPC 通道名称}
status: draft
version: {v1}
related_features: []
---

# {IPC_ID}: {IPC 通道名称}

<!-- 本模板是插件 starter 指导，项目本地模板可完全覆盖 -->
<!-- 插件模板是入门指导，项目本地模板是权威 -->

## 概述

{描述这个 IPC 通道的用途、通信方向和主要能力}

## 基础信息

- **版本**：{version}
- **通信方向**：Frontend → Backend / Backend → Frontend / 双向
- **通道名称**：{channel_name}
- **框架**：Tauri / Electron / 自定义

## 消息定义

### 请求消息

```typescript
interface {RequestName} {
  // 请求标识
  id: string;
  // 请求类型
  type: "{request_type}";
  // 请求载荷
  payload: {
    field1: string;
    field2: number;
    field3?: boolean;  // 可选字段
  };
}
```

### 响应消息

```typescript
interface {ResponseName} {
  // 对应请求 ID
  requestId: string;
  // 响应状态
  status: "success" | "error";
  // 成功时的数据
  data?: {
    result: string;
    metadata?: Record<string, unknown>;
  };
  // 错误时的信息
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

### 事件消息（后端主动推送）

```typescript
interface {EventName} {
  // 事件类型
  type: "{event_type}";
  // 事件载荷
  payload: {
    timestamp: number;
    data: unknown;
  };
}
```

## 通道列表

### {channel_name}

**描述**：{通道描述}

**方向**：{Frontend → Backend / Backend → Frontend / 双向}

**请求示例**：

```typescript
// 前端发送
invoke("{channel_name}", {
  param1: "value",
  param2: 123
});

// 后端响应
{
  requestId: "req_123",
  status: "success",
  data: { result: "processed" }
}
```

**错误处理**：

| 错误码 | 描述 | 前端处理 |
|--------|------|---------|
| INVALID_PARAM | 参数无效 | 提示用户修正输入 |
| TIMEOUT | 请求超时 | 重试或提示稍后 |
| PERMISSION_DENIED | 权限不足 | 提示用户授权 |
| INTERNAL_ERROR | 内部错误 | 记录日志，提示联系支持 |

## 序列化规范

### 数据格式

- **编码**：JSON / MessagePack / Protobuf
- **字符编码**：UTF-8
- **日期格式**：ISO 8601 或 Unix 时间戳
- **数字精度**：整数 i64，浮点 f64

### 类型映射

| TypeScript | Rust/后端 | 说明 |
|-----------|----------|------|
| string | String | UTF-8 字符串 |
| number | i64 / f64 | 整数或浮点 |
| boolean | bool | 布尔值 |
| Array<T> | Vec<T> | 数组 |
| object | Struct | 对象 |
| null | Option::None | 可选值 |

## 边界规则

### 前端职责

- UI 状态管理
- 用户输入验证
- 错误展示
- 加载状态

### 后端职责

- 业务逻辑处理
- 数据持久化
- 文件系统访问
- 系统 API 调用
- 安全验证

### 禁止事项

- ❌ 前端直接访问文件系统
- ❌ 前端存储敏感信息（密码、Token 明文）
- ❌ 后端直接操作 DOM
- ❌ 绕过 IPC 通道的通信

## 性能要求

| 指标 | 目标值 | 说明 |
|------|-------|------|
| 单次调用延迟 | < {X} ms | 本地调用 |
| 大数据传输 | 分片传输 | 超过 1MB 的数据 |
| 并发调用 | 限制 {N} 个 | 防止资源耗尽 |
| 超时时间 | {X} 秒 | 默认超时 |

## 安全考虑

### 输入验证

- [ ] 所有输入参数在后端验证
- [ ] 防止路径遍历攻击
- [ ] 防止注入攻击
- [ ] 限制输入长度和大小

### 权限控制

- [ ] 敏感操作需要权限确认
- [ ] 最小权限原则
- [ ] 权限检查在后端执行

### 错误信息

- [ ] 不暴露内部实现细节
- [ ] 错误码和消息分离
- [ ] 敏感信息不记录日志

## 版本兼容

### 向后兼容规则

- 新增字段使用可选类型
- 不删除已有字段
- 不改变字段类型
- 新增通道不影响已有通道

### 破坏性变更处理

- 版本号递增
- 迁移指南文档
- 旧版本兼容期
- 客户端升级提示

## 关联制品

- 功能特性：{related_features}
- 设计文档：{related_designs}
- UI 契约：{related_ui_contracts}

## 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| {YYYY-MM-DD} | v1 | 初始版本 | {作者} |
