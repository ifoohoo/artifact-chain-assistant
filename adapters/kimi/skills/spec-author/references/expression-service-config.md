# 表达服务配置合同

本文件是随 `skill-family-docs` 四宿主投影分发的公共配置参考。它描述同技能分发的 `scripts/expression-outbound.mjs` 的真实合同。安装者选择 OpenAI 兼容服务和模型；本参考不默认绑定任何模型，也不从 `LLM_*` 或其他环境变量自动补齐三项配置。

起草、刷新或整篇重写依赖这三项配置。配置检查本身不联网、不读取文稿、不写文件，也不验证服务可达、凭据有效或模型可用。三项齐全只表示本地进程环境看起来完整，不能声称服务已经可用。

## 三项环境变量

安装者通过下列三项环境变量选择服务、模型及凭据来源。第三项的值是存放 key 的环境变量名，不是 key 本身。凭据值只从该名称对应的、已继承的进程环境读取，不从认证文件、聊天、命令行参数取得，也不修改 shell。

```bash
export SKILL_FAMILY_DOCS_ENDPOINT='https://api.example.com/v1'
export SKILL_FAMILY_DOCS_MODEL='your-selected-model'
export SKILL_FAMILY_DOCS_CREDENTIAL_ENV='MY_DOCS_API_KEY'
```

示例地址与模型名只说明格式，必须替换为用户选定的值。实际 API key 由用户在自己的 shell 或已有安全来源中设置并导出至 `MY_DOCS_API_KEY`；若使用其他变量名，需同步更新第三项。严禁将 key 发送至聊天、写入项目文件或日志，亦不可作为命令行参数传入。

## 本地配置检查

在运行技能的进程环境中，仅检查以下条件是否存在、非空及凭据变量名是否合法，不显示任何配置值。按项目匹配的 Node.js 运行时执行以下本地命令；不得开启命令跟踪或输出完整环境。

```bash
node --input-type=module <<'NODE'
const env = process.env;
const name = env.SKILL_FAMILY_DOCS_CREDENTIAL_ENV;
const validName = typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
const checks = {
  endpoint: Boolean(env.SKILL_FAMILY_DOCS_ENDPOINT),
  model: Boolean(env.SKILL_FAMILY_DOCS_MODEL),
  credentialName: validName,
  credentialValue: validName && typeof env[name] === 'string' && env[name].length > 0,
};
console.log(JSON.stringify(checks));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 2;
NODE
```

该命令仅读取进程环境，输出固定四项布尔结果：`endpoint`（基础地址存在）、`model`（模型名存在）、`credentialName`（凭据变量名合法）、`credentialValue`（凭据变量值存在）。退出码 0 表示四项齐全，退出码 2 表示缺项或凭据变量名不合法。不得调用 `expression-outbound.mjs` 并附带虚构输入输出探测配置；配置齐全时，该入口将按实际外发流程执行。

## 进程继承

临时 `export` 仅影响当前 shell 及其后续启动的子进程。用户自行修改可信的 shell 配置后，需重新加载该配置；已启动的宿主进程不会自动继承新配置。退出宿主后从已配置的环境重新启动，或按宿主正常方式重启并核对实际进程配置。仅新开任务无法保证环境已更新。不自动编辑 shell 配置，不读取认证文件或用户级模型配置。

## 脚本调用合同

从技能根目录运行 `scripts/expression-outbound.mjs`。输入与上下文路径按当前工作目录解析。`--output` 必须为仓外绝对路径，通常使用系统临时目录；每次调用应指定新候选路径，保留原稿与历次候选。候选输出仅创建新文件，已有文件或链接将被拒绝，不覆盖原稿或历次候选。

```bash
node scripts/expression-outbound.mjs --input 材料.md --context 上下文.md --output /绝对仓外路径/unit.candidate.md --timeout-ms 180000
```

可选参数 `--endpoint`、`--model`、`--credential-env` 用于覆盖环境变量配置，但凭据参数仍仅支持环境变量名。`--timeout-ms` 为单次请求超时时间，默认 60000 毫秒，可按单元需求显式调整，超时后停止且不自动重试。脚本没有接受候选的权限，也不判风格或语义。

状态字段为 `candidate-produced`（产出待审候选）、`not-configured`（缺配置）或 `failed`（调用失败）。失败原因按 `reasonClass` 分类：`missing-config`、`http-status`、`timeout`、`unparseable`、`truncated`、`empty-body`、`non-text`、`connection`、`tls`、`credential-via-cli`、`in-repo-output`、`invalid-input`。诊断信息仅记录状态、原因类、退出码与必要路径，不回放正文、凭据、授权头或认证配置。

退出码：`candidate-produced` 为 0；`not-configured` 为 2；`invalid-input`、`credential-via-cli`、`in-repo-output` 为 2；其余失败为 1。
