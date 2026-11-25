# 接入阅读交付

先由作者准备完整且符合 Docs 0.7.0 markdown-v1 的阅读稿，并核对源与稿件的含义。正文以说明段落开头；页面标题由页面清单承担，正文不放 H1，不使用任意 HTML、嵌套列表或未标语言的代码块。稳定章节使用 `## 场景名称 {#scene-id}`。不符合公开输入合同的稿件由作者处理，build 不删段或改成摘要。

项目根配置示例：

```json
{
  "schemaVersion": 1,
  "title": "本次选中资料",
  "inputs": ["artifact-reading/input.json"],
  "output": "dist/reading",
  "productKind": "library"
}
```

输入文件使用 `schemaVersion: 1` 和 `documents` 数组。每项写入 `target`、`sourceRevision`、`pageId`、`title`、`markdown`、`markdownRevision`。路径相对项目根；两项修订采用 `sha256:` 加64位小写十六进制，由制作阶段取得。原件路径从 Graph 的目标身份解析，不在输入里另维护一份。完整字段见包内 `schemas/artifact-reading.schema.json`。正文中的本地SVG须使用Docs允许的 `assets/<安全文件名>.svg` 路径，并由该文档的图资源明确选入；图资源可相对项目根或文章目录定位，构建不改写图片语法。

图按需填写 `figures`：每图包含 `id`、`title`、`html`、`resources`、`bindings`；可加 `svg` 和视觉导航用的 `parent` 图身份。每条绑定为 `nodeId`、`pageId`、`anchor`。资源必须逐文件列出，原生 HTML/CSS/JS 的实际引用会检查；不能依赖原电脑或远端资源补齐。没有 SVG 时保留原生 HTML 和步骤选择器；提供 SVG 时浏览器可以在同源条件下绑定已声明节点。外壳不重新绘图。

```bash
node node_modules/artifact-chain-assistant/scripts/artifact-reading.mjs build --root . --config artifact-reading/config.json
node node_modules/artifact-chain-assistant/scripts/artifact-reading.mjs check --root . --config artifact-reading/config.json
node node_modules/artifact-chain-assistant/scripts/artifact-reading.mjs bundle --root . --config artifact-reading/config.json --out delivery/reading-r1
node node_modules/artifact-chain-assistant/scripts/artifact-reading.mjs preview --root . --config artifact-reading/config.json --port 8000
```

四命令支持 `--output` 选择本次生成目录，bundle 的 `--out` 仍是新导出目录，可以同时传入。构建与检查不会更新双摘要或 Graph 锁，也不调用模型。Docs 只执行普通 render 和 --check，不启用 coverage，不声称通过 --check-project。

同目录更新沿 Foundation 原子交换。Windows 不支持既有目录交换时，保留旧结果，改用新的 --output，再以相同参数检查、导出和预览；不需要删除旧目录。已提交或状态不明的错误须保留两侧材料，不自动回滚、重试或清理。成功返回的 displacedTargetPath 才是被替换旧目录的位置。

维护包须带精确依赖、锁文件及未发布候选的本地 tarball，在独立新目录执行 npm ci 和真实构建，不能依赖父仓开发依赖。纯阅读包从 index.html 阅读，不需要 npm、模型或原工作树。新目录验证只说明实际环境，不代表所有平台已经通过。
