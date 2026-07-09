# Artifact Chain Assistant

[English](README.md)

Artifact Chain Assistant 是面向 `artifact-graph` 项目的 Codex / Claude Code 助手插件。

它打包了可复用 skills、适配器 manifest、命令、hooks 和安装指引，帮助 agent 发现正确制品上下文、
初始化项目本地配置，并维护 traceability version lock。

## 提供什么

- `where-am-i`：面向 artifact-chain 项目的入口分诊和路由。
- `artifact-chain-maintainer`：version-lock、audit、doctor 和 hook 维护指引。
- `artifact-chain-bootstrap`：显式调用的项目初始化技能。
- Codex 和 Claude Code adapter 资产。
- Git hook 模板和安装器。

## 安装

请阅读完整安装指南：

```text
INSTALL.md
```

每个目标项目都保留自己的 `artifact-graph.config.yaml`、`artifacts/**`、
`artifacts/traceability-version-lock.json`、`AGENTS.md`，以及可选的 `CLAUDE.md`。

## 相关项目

在使用插件做硬性校验之前，请先在目标项目中安装
[`artifact-graph`](https://github.com/mzdbxqh/artifact-graph)。

## 开源协议

Apache-2.0。详见 [LICENSE](LICENSE)。
