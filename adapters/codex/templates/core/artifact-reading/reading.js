/* Navigation only. No business state, persistence, Markdown or diagram rendering. */
(() => {
  const model = JSON.parse(document.getElementById('reading-model').textContent);
  const get = id => document.getElementById(id);
  const url = path => path.split('/').map(encodeURIComponent).join('/');
  const positions = new Map(), history = [];
  let currentFigure = null, currentDocument = null, currentAnchor = '', locationKnown = false;
  function metadata(doc, anchor) {
    currentDocument = doc; currentAnchor = anchor;
    get('article-link').href = `articles/${url(doc.pageId)}.html${anchor ? '#' + encodeURIComponent(anchor) : ''}`;
    get('source').href = url(doc.source);
    get('identity').textContent = `${doc.target} · 原件 ${doc.sourceRevision} · 文章 ${doc.markdownRevision}`;
  }
  function syncArticlePosition() {
    try {
      const actual = new URL(get('article').contentWindow.location.href);
      const doc = model.documents.find(item => {
        const expected = new URL(`articles/${url(item.pageId)}.html`, window.location.href);
        return expected.origin === actual.origin && expected.pathname === actual.pathname;
      });
      if (!doc) throw new Error('outside selected articles');
      metadata(doc, decodeURIComponent(actual.hash.slice(1)));
      locationKnown = true; get('locator').disabled = false;
    } catch {
      locationKnown = false; get('locator').disabled = true;
      get('location-text').hidden = true;
      get('identity').textContent = '无法读取当前文章的实际位置；请独立打开文章并附上实际链接，不沿用之前的定位。';
    }
  }
  function article(pageId, anchor = '') {
    const doc = model.documents.find(item => item.pageId === pageId);
    if (!doc) return;
    metadata(doc, anchor); locationKnown = false; get('locator').disabled = true; get('location-text').hidden = true;
    const href = `articles/${url(pageId)}.html${anchor ? '#' + encodeURIComponent(anchor) : ''}`;
    get('article').src = href;
  }
  function step(index) {
    if (!currentFigure) return;
    const binding = currentFigure.bindings[index];
    if (!binding) return;
    positions.set(currentFigure.id, index); get('steps').value = String(index);
    article(binding.pageId, binding.anchor);
    get('node-links').replaceChildren();
    currentFigure.bindings.forEach((target, targetIndex) => {
      if (target.nodeId !== binding.nodeId) return;
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = `${target.pageId} / ${target.anchor}`;
      button.addEventListener('click', () => step(targetIndex)); get('node-links').append(button);
    });
  }
  function figure(id, push = true) {
    const next = model.figures.find(item => item.id === id); if (!next) return;
    if (push && currentFigure && currentFigure.id !== id) history.push(currentFigure.id);
    currentFigure = next;
    get('steps').replaceChildren(); get('node-links').replaceChildren();
    next.bindings.forEach((binding, index) => {
      const option = document.createElement('option'); option.value = String(index);
      option.textContent = `${binding.nodeId} → ${binding.pageId} / ${binding.anchor}`; get('steps').append(option);
    });
    get('native').href = url(`visual/${next.html}`);
    // A supplied SVG stays byte-identical. The browser displays it; this shell
    // only attaches declared node links when same-origin access is available.
    get('diagram').src = url(`visual/${next.svg ?? next.html}`);
    get('diagram').hidden = false;
    get('graph-note').textContent = next.svg ? '可点击已声明的图节点，或用步骤选择器阅读正文。若浏览器直开限制节点点击，请按阅读说明使用本地服务。' : '原生HTML保持独立；步骤选择器提供已声明的位置对应。';
    if (!next.bindings.length) get('graph-note').textContent += ' 当前图没有声明正文绑定。';
    get('back').disabled = history.length === 0 && !next.parent;
    step(positions.get(next.id) ?? 0);
  }
  get('diagram').addEventListener('load', () => {
    if (!currentFigure?.svg) return;
    try {
      const doc = get('diagram').contentDocument;
      const linked = new Set();
      for (const [index, binding] of currentFigure.bindings.entries()) {
        if (linked.has(binding.nodeId)) continue;
        linked.add(binding.nodeId);
        const node = doc.getElementById(binding.nodeId);
        if (!node) continue;
        node.style.cursor = 'pointer';
        node.addEventListener('click', event => { event.preventDefault(); step(index); });
      }
    } catch { /* file: isolation is explained, with a selector fallback. */ }
  });
  get('steps').addEventListener('change', () => step(Number(get('steps').value)));
  get('article').addEventListener('load', () => {
    syncArticlePosition();
    try { get('article').contentWindow.addEventListener('hashchange', syncArticlePosition); } catch { /* Cross-origin/file isolation keeps locating disabled. */ }
  });
  get('back').addEventListener('click', () => figure(history.pop() ?? currentFigure?.parent, false));
  get('search').addEventListener('input', () => {
    const term = get('search').value.toLocaleLowerCase();
    for (const button of get('documents').children) button.hidden = !button.textContent.toLocaleLowerCase().includes(term);
  });
  for (const doc of model.documents) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `${doc.title} · ${doc.target}`;
    button.addEventListener('click', () => article(doc.pageId)); get('documents').append(button);
  }
  for (const item of model.figures) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = item.title;
    button.addEventListener('click', () => figure(item.id)); get('figures').append(button);
  }
  get('locator').addEventListener('click', () => {
    if (!currentDocument || !locationKnown) return;
    const box = get('location-text'); box.hidden = false;
    box.value = `对象：${currentDocument.target}\n原件修订：${currentDocument.sourceRevision}\n文章修订：${currentDocument.markdownRevision}\n阅读位置：articles/${currentDocument.pageId}.html${currentAnchor ? '#' + currentAnchor : ''}\n本次已查范围：所交阅读包的标题与稳定身份\n原问题/待处理问题：\n提出者：\n说明：这只是可转交文本，尚未保存、送达或受理。`;
    box.focus(); box.select();
  });
  article(model.documents[0].pageId);
  if (model.figures.length) figure(model.figures.find(item => !item.parent)?.id ?? model.figures[0].id, false);
  else { get('diagram').hidden = true; get('native').hidden = true; get('steps').hidden = true; get('back').disabled = true; }
})();
