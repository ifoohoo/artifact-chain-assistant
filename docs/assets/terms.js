// SPDX-License-Identifier: Apache-2.0
// 自研术语气泡引擎：仅暴露 window.TERMS / window.TERM_MAP，尾部 IIFE 处理 <dfn data-term>。
// 无第三方依赖，可 file:// 双击。对 CODE/PRE/A/SVG/BUTTON/NAV/H1/TEXTAREA 不做处理。
window.TERMS = [
  {
    key: "artifact-graph",
    cat: "核心运行时",
    full: "artifact-graph",
    cn: "制品图运行时",
    plain: "扫描 Markdown 制品、建立追溯图、并提供校验与上下文抽取命令行的 Node 工具",
    it: "类似 eslint，但校验对象不是代码风格，而是「需求→设计→实现→评审」之间的链路是否闭合",
    role: "底层"
  },
  {
    key: "artifact-chain-assistant",
    cat: "上层插件",
    full: "artifact-chain-assistant",
    cn: "制品链助手插件",
    plain: "给 Codex / Claude Code 用的插件，把制品链工作法接进日常开发会话",
    it: "类似 Prettier 的编辑器插件，但作用对象是研发流程治理而非代码格式",
    role: "上层"
  },
  {
    key: "artifact",
    cat: "基础概念",
    full: "artifact",
    cn: "制品",
    plain: "研发过程中产生、需要被追溯的任何产物：需求、场景、设计、决策、测试、代码、文档",
    it: "类似 git 里的一次提交对象，但它记录的是「为什么做」而非「改了哪行」",
    role: "基础"
  },
  {
    key: "traceability",
    cat: "基础概念",
    full: "traceability",
    cn: "可追溯性",
    plain: "任一制品都能向上追到来源、向下追到影响，形成一张可验证的图",
    it: "类似数据库外键，但跨的是文档与文档、文档与代码",
    role: "基础"
  },
  {
    key: "deterministic",
    cat: "核心约束",
    full: "deterministic",
    cn: "确定性",
    plain: "同一份配置与源文件，无论谁、在哪台机器、跑多少次，结果完全一致、可复现",
    it: "类似纯函数，相同输入永远得到相同输出",
    role: "约束"
  },
  {
    key: "git-native",
    cat: "核心约束",
    full: "git-native",
    cn: "Git 原生",
    plain: "以 Git 作为唯一事实来源与版本载体，不引入额外数据库或服务",
    it: "类似用 git 当数据库，而非另起一个 Postgres",
    role: "约束"
  },
  {
    key: "version-lock",
    cat: "核心机制",
    full: "version-lock",
    cn: "版本锁",
    plain: "把制品之间的追溯关系固化成一份版本化基线，同时作为提交事务的边界",
    it: "类似 package-lock.json，但锁的是「关系」而非「依赖版本」",
    role: "机制"
  },
  {
    key: "context-packet",
    cat: "核心机制",
    full: "context packet",
    cn: "确定性上下文包",
    plain: "把某次任务需要的制品子集，按确定规则抽取成一个自包含、可重放的输入包",
    it: "类似 docker 镜像，但装的是「任务所需的上下文」而非运行环境",
    role: "机制"
  },
  {
    key: "review-result-protocol",
    cat: "核心协议",
    full: "Review Result Protocol",
    cn: "评审结果协议",
    plain: "规定 AI 产出评审结果的结构与语义：默认失败关闭、身份稳定、禁止自我接受修复",
    it: "类似 HTTP 状态码约定，但约束的是「AI 说自己做完了」这件事的可信度",
    role: "协议"
  },
  {
    key: "contract-kernel",
    cat: "架构 [已实现]",
    full: "Contract Kernel",
    cn: "契约内核",
    plain: "运行时侧定义的一组稳定契约接口，供上层助手以统一方式调用图能力",
    it: "类似操作系统的系统调用表，上层不必关心内核实现",
    role: "架构"
  },
  {
    key: "family-api",
    cat: "架构 [已实现]",
    full: "Family API",
    cn: "标准族 API",
    plain: "把一类制品的通用操作抽象成标准族接口，新类型可声明式接入",
    it: "类似一组 REST 资源约定，新增资源只需遵守同一套路由",
    role: "架构"
  },
  {
    key: "registry-v2",
    cat: "架构 [已实现]",
    full: "Registry v2 (SPI)",
    cn: "方法注册表 v2",
    plain: "与图结构正交的方法提供方注册表：身份、清单、绑定、投影、严格方法锁",
    it: "类似插件市场的清单与权限模型，但每个方法都有稳定身份与运行锁",
    role: "架构"
  },
  {
    key: "doctor",
    cat: "命令",
    full: "doctor",
    cn: "诊断命令",
    plain: "运行环境与配置自检，作为接入后的第一步安全检查",
    it: "类似 brew doctor / npm doctor，先排环境雷",
    role: "命令"
  },
  {
    key: "help",
    cat: "技能 [已实现]",
    full: "artifact.help",
    cn: "帮助技能",
    plain: "只读地列出当前项目有哪些 Family API 和采用步骤，不改任何文件，是装好之后该跑的第一步",
    it: "类似软件的「帮助」菜单，但列出来的是这套研发方法的入口，而不是界面按钮",
    role: "发现"
  },
  {
    key: "setup",
    cat: "技能 [已实现]",
    full: "artifact.setup",
    cn: "诊断技能",
    plain: "只读地检查你的环境：插件闭包完不完整、Node 和 CLI 版本够不够、配置缺不缺",
    it: "类似 doctor，但更偏「我这套环境能不能跑起来」的体检",
    role: "诊断"
  },
  {
    key: "quickstart",
    cat: "技能 [已实现]",
    full: "artifact.quickstart",
    cn: "上手路由技能",
    plain: "你拿不准该用哪个技能时，它按你的意图把你引到正确的那个：能力问题找 help、环境问题找 setup、要初始化就走 bootstrap",
    it: "类似客服的「转接」分流，但它分的是研发技能",
    role: "路由"
  },
  {
    key: "bootstrap",
    cat: "技能 [已实现]",
    full: "artifact-chain-bootstrap",
    cn: "项目初始化技能",
    plain: "第一次把一个项目接入制品链时用的引导：帮你判断项目类型、裁剪制品类型、生成或更新配置",
    it: "类似 create-react-app 的初始化向导，但产出的是治理配置，不是代码脚手架",
    role: "初始化"
  }
];

(function () {
  "use strict";
  var MAP = {};
  window.TERMS.forEach(function (t) { MAP[t.key] = t; });
  window.TERM_MAP = MAP;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function buildCard(t) {
    var parts = [];
    parts.push("<b>" + esc(t.full) + "</b>");
    if (t.cat) parts.push(' <span class="k">[' + esc(t.cat) + "]</span>");
    if (t.cn) parts.push('<div><span class="k">中文：</span>' + esc(t.cn) + "</div>");
    if (t.plain) parts.push('<div><span class="k">大白话：</span>' + esc(t.plain) + "</div>");
    if (t.it) parts.push('<div class="it"><span class="k">类比：</span>' + esc(t.it) + "</div>");
    if (t.role) parts.push('<div><span class="k">定位：</span>' + esc(t.role) + "</div>");
    return parts.join("");
  }

  function init() {
    var dfns = document.querySelectorAll("dfn[data-term]");
    Array.prototype.forEach.call(dfns, function (el) {
      var key = el.getAttribute("data-term");
      var t = MAP[key];
      if (!t) return;
      var span = document.createElement("span");
      span.className = "term";
      span.tabIndex = 0;
      var pop = document.createElement("span");
      pop.className = "term-pop";
      pop.setAttribute("role", "tooltip");
      pop.innerHTML = buildCard(t);
      span.textContent = el.textContent;
      span.appendChild(pop);
      el.replaceWith(span);
    });
  }

  function renderGlossary() {
    var box = document.getElementById("glossary");
    if (!box) return;
    box.innerHTML = window.TERMS.map(function (t) {
      return '<section class="card term-entry" id="t-' + esc(t.key) + '">' +
        '<h2>' + esc(t.full) + ' <span class="k">[' + esc(t.cat) + ']</span></h2>' +
        (t.cn ? '<div><span class="k">中文：</span>' + esc(t.cn) + '</div>' : '') +
        (t.plain ? '<div><span class="k">大白话：</span>' + esc(t.plain) + '</div>' : '') +
        (t.it ? '<div class="it"><span class="k">类比：</span>' + esc(t.it) + '</div>' : '') +
        (t.role ? '<div><span class="k">定位：</span>' + esc(t.role) + '</div>' : '') +
        '</section>';
    }).join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(); renderGlossary(); });
  } else {
    init();
    renderGlossary();
  }
})();
