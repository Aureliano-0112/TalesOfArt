/* ══════════════════════════════════════════════════════════
   《谈艺录》原文 · 导读 阅读器
   · 栏目与文件夹的对应关系写在 site.config.json
   · 篇目清单来自 data/manifest.json（本地开发时改用 /api/manifest 实时扫描）
   · 打开页面只加载当前一篇，其余在后台预取
   ══════════════════════════════════════════════════════════ */
(function () {
"use strict";

function $(id) { return document.getElementById(id); }

/* ═══ 一、Markdown 渲染 ═══════════════════════════════════
   只覆盖实际用到的语法：标题、引文、表格、列表、分隔符、
   粗体、斜体、行内码。全部本地实现，无外部依赖。          */

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* 【补订】【补正】等是钱锺书后来添的札记，原文里用朱色标出 */
var BD = /【(补订|补正|附说|补记|补注)】/g;

function inline(raw) {
  var t = esc(raw);
  t = t.replace(BD, '<span class="bd">【$1】</span>');
  t = t.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}

/* 原文用的是直引号 "。按出现顺序全文交替，成对转成中文引号 “ ”，
   这样即使引文跨行、跨段，配对也不会错。 */
function prettify(md) {
  var open = false;
  return md.replace(/"/g, function () { open = !open; return open ? "\u201C" : "\u201D"; });
}

/* 行末是句读或收束符号 = 硬换行（诗行、独立引文）；是逗号/冒号/开引号 = 折行 */
var END_STOP = /[。！？!?”」』）】》〕]\s*$/;

function isHr(l) { return /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l); }
function isSep(l) { return /^\s*\|?[\s:\-|]+\|[\s:\-|]*$/.test(l) && l.indexOf("-") > -1; }
function isHeading(l) { return /^#{1,6}\s+/.test(l); }
function isQuote(l) { return /^\s*>/.test(l); }
function isUl(l) { return /^\s*[-*+]\s+/.test(l); }
function isOl(l) { return /^\s*\d+\.\s+/.test(l); }
function isRow(l) { return /^\s*\|/.test(l); }

function cells(line) {
  var s = line.trim();
  if (s.charAt(0) === "|") s = s.slice(1);
  if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
  return s.split("|").map(function (c) { return c.trim(); });
}

function renderHeading(level, text) {
  if (level === 2) {
    var t = text.trim(), star = "", num = "";
    if (/^★\s*/.test(t)) { star = '<span class="star">★</span>'; t = t.replace(/^★\s*/, ""); }
    var m = t.match(/^([一二三四五六七八九十百]+、)([\s\S]*)$/);
    if (m) { num = '<span class="h2n">' + m[1] + "</span>"; t = m[2]; }
    return "<h2>" + star + num + inline(t) + "</h2>";
  }
  return "<h" + level + ">" + inline(text.trim()) + "</h" + level + ">";
}

function renderBlocks(lines) {
  var out = [], i = 0, n = lines.length;
  while (i < n) {
    var line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }
    if (isHr(line)) { out.push("<hr>"); i++; continue; }

    var hm = line.match(/^(#{1,6})\s+(.*?)\s*$/);
    if (hm) { out.push(renderHeading(hm[1].length, hm[2])); i++; continue; }

    if (isRow(line) && i + 1 < n && isSep(lines[i + 1])) {
      var head = cells(line), rows = [];
      i += 2;
      while (i < n && isRow(lines[i]) && lines[i].trim() !== "") { rows.push(cells(lines[i])); i++; }
      var w = head.length;
      var h = '<div class="tw"><table><thead><tr>' +
        head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") +
        "</tr></thead><tbody>";
      h += rows.map(function (r) {
        var c = r.slice(0, w);
        while (c.length < w) c.push("");
        return "<tr>" + c.map(function (x) { return "<td>" + inline(x) + "</td>"; }).join("") + "</tr>";
      }).join("");
      out.push(h + "</tbody></table></div>");
      continue;
    }

    if (isQuote(line)) {
      var buf = [];
      while (i < n && isQuote(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out.push(renderQuote(buf));
      continue;
    }

    if (isUl(line)) {
      var items = [];
      while (i < n && isUl(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; }
      out.push("<ul>" + items.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</ul>");
      continue;
    }

    if (isOl(line)) {
      var oitems = [];
      while (i < n && isOl(lines[i])) { oitems.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      out.push("<ol>" + oitems.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</ol>");
      continue;
    }

    var para = [];
    while (i < n && !/^\s*$/.test(lines[i]) && !isHr(lines[i]) && !isHeading(lines[i]) &&
           !isQuote(lines[i]) && !isUl(lines[i]) && !isOl(lines[i]) && !isRow(lines[i])) {
      para.push(lines[i].trim()); i++;
    }
    if (!para.length) { i++; continue; }
    var groups = [], cur = "";
    for (var k = 0; k < para.length; k++) {
      cur += para[k];
      if (k < para.length - 1 && END_STOP.test(cur)) { groups.push(cur); cur = ""; }
    }
    if (cur) groups.push(cur);
    groups.forEach(function (t) {
      out.push('<p' + (/^原文[:：]/.test(t) ? ' class="p-src"' : "") + ">" + inline(t) + "</p>");
    });
  }
  return out.join("\n");
}

function renderQuote(buf) {
  var k = 0;
  while (k < buf.length && buf[k].trim() === "") k++;
  var head = "";
  if (k < buf.length) {
    var m = buf[k].trim().match(/^\*\*([\s\S]+?)\*\*\s*[:：]?$/);
    if (m) { head = m[1]; buf = buf.slice(0, k).concat(buf.slice(k + 1)); }
  }
  var body = renderBlocks(buf);
  return '<div class="quote">' +
    (head ? '<div class="quote-head">' + inline(head) + "</div>" : "") +
    '<div class="quote-body">' + body + "</div></div>";
}

/* 拆出 H1 与题记，其余交渲染器 */
function parseArticle(md) {
  var lines = md.replace(/\r\n?/g, "\n").split("\n");
  var title = "", ti = -1;
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^#\s+(.*)$/);
    if (m) { title = m[1].trim(); ti = i; break; }
  }
  var tag = [];
  if (ti > -1) {
    var j = ti + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    if (j < lines.length && isQuote(lines[j])) {
      var buf = [], s = j;
      while (j < lines.length && isQuote(lines[j])) { buf.push(lines[j].replace(/^\s*>\s?/, "").trim()); j++; }
      tag = buf.filter(Boolean);
      lines.splice(s, j - s);
    }
    lines.splice(ti, 1);
  }
  return { title: title, tag: tag, body: lines.join("\n") };
}

/* ═══ 二、篇目元数据 ═════════════════════════════════════ */
var CN = { "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5,
           "六": 6, "七": 7, "八": 8, "九": 9 };

function cn2num(s) {
  if (s === "十") return 10;
  var m = s.match(/^十([一二三四五六七八九])$/);
  if (m) return 10 + CN[m[1]];
  m = s.match(/^([一二三四五六七八九])十([一二三四五六七八九])?$/);
  if (m) return CN[m[1]] * 10 + (m[2] ? CN[m[2]] : 0);
  if (CN[s] !== undefined) return CN[s];
  return null;
}

function sectionLabel(name) {
  var m = name.match(/第([一二三四五六七八九十百]+)节/);
  return m ? "第" + m[1] + "节" : name.replace(/\.md$/i, "");
}

function sectionOrder(name) {
  var m = name.match(/第([一二三四五六七八九十百]+)节/);
  if (!m) return null;
  var v = cn2num(m[1]);
  return v === null ? null : v;
}

function keyOf(item) {
  return item.order === null || item.order === undefined ? item.name : "s" + item.order;
}

/* ═══ 三、状态 ═══════════════════════════════════════════ */
var CFG = null, MAN = null;
var state = { col: "", items: [], cur: -1, cache: {}, mode: "static", req: 0, warm: 0 };

function colById(id) {
  for (var i = 0; i < CFG.collections.length; i++) {
    if (CFG.collections[i].id === id) return CFG.collections[i];
  }
  return null;
}

function otherCol(id) {
  for (var i = 0; i < CFG.collections.length; i++) {
    if (CFG.collections[i].id !== id) return CFG.collections[i];
  }
  return null;
}

function listOf(colId) {
  return (MAN.collections && MAN.collections[colId]) || [];
}

/* 在另一栏目里找同一节 */
function mateOf(colId, order) {
  if (order === null || order === undefined) return null;
  var list = listOf(colId);
  for (var i = 0; i < list.length; i++) {
    if (list[i].order === order) {
      var m = list[i];
      return { id: colId, key: keyOf(m), label: m.label };
    }
  }
  return null;
}

/* ═══ 四、取数据 ═════════════════════════════════════════ */
function fetchText(url) {
  return fetch(url, { cache: "no-store" }).then(function (r) {
    if (!r.ok) throw new Error(r.status + " " + url);
    return r.text();
  });
}

function loadConfig() {
  return fetchText("site.config.json").then(JSON.parse);
}

/* 本地预览时 /api/manifest 每次刷新实时扫描；发布到 Pages 上则退回静态清单 */
function loadManifest() {
  return fetchText("api/manifest").then(function (t) {
    var m = JSON.parse(t);
    if (!m || !m.collections) throw new Error("bad manifest");
    state.mode = "live";
    return m;
  }).catch(function () {
    return fetchText("data/manifest.json").then(function (t) {
      state.mode = "static";
      return JSON.parse(t);
    });
  });
}

/* ═══ 五、栏目切换 ═══════════════════════════════════════ */
function buildTabs() {
  var box = $("tabs");
  box.innerHTML = "";
  CFG.collections.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tab";
    b.dataset.col = c.id;
    b.setAttribute("role", "tab");
    b.textContent = c.label;
    b.addEventListener("click", function () { switchTo(c.id, null); });
    box.appendChild(b);
  });
}

function syncTabs() {
  var tabs = $("tabs").children;
  for (var i = 0; i < tabs.length; i++) {
    var on = tabs[i].dataset.col === state.col;
    tabs[i].classList.toggle("on", on);
    tabs[i].setAttribute("aria-selected", on ? "true" : "false");
  }
  var col = colById(state.col);
  if (col) $("spineSub").textContent = col.label;
}

function switchTo(colId, key, keepHash) {
  var col = colById(colId) || CFG.collections[0];
  if (!col) return;
  state.col = col.id;
  state.items = listOf(col.id).slice();
  state.items.forEach(function (it, i) { it.idx = i; it.key = keyOf(it); });
  state.cur = -1;

  syncTabs();
  renderTOC($("q").value);

  if (!state.items.length) {
    showEmpty(col);
    document.title = CFG.title + " · " + col.label;
    return;
  }
  var idx = 0;
  if (key != null) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].key === key) { idx = i; break; }
    }
  }
  go(idx, keepHash);
  warmup();
}

/* ═══ 六、目次 ═══════════════════════════════════════════ */
function renderTOC(filter) {
  var toc = $("toc");
  var kw = (filter || "").trim().toLowerCase();
  var shown = 0;

  var html = state.items.map(function (it) {
    var hit = true;
    if (kw) {
      hit = (it.title + " " + it.lead + " " + it.name).toLowerCase().indexOf(kw) > -1;
      if (!hit && it._hay && it._hay.indexOf(kw) > -1) hit = "body";
    }
    if (kw && !hit) return "";
    shown++;
    var mark = hit === "body" ? '<span class="hit">正文</span>' : "";
    return '<a href="#' + state.col + "/" + encodeURIComponent(it.key) + '"' +
      (it.idx === state.cur ? ' class="on"' : "") + ">" +
      '<span class="num">' + esc(it.label) + "</span>" +
      '<span class="ti">' + mark + esc(it.lead || it.title) + "</span></a>";
  }).join("");

  if (!state.items.length) {
    var col = colById(state.col);
    toc.innerHTML = '<div class="rail-empty">' +
      esc((col && col.empty) || "这个栏目下还没有 .md 文件。") + "</div>";
    $("count").textContent = "共 0 篇";
    return;
  }
  toc.innerHTML = html || '<div class="rail-empty">没有匹配的篇目。</div>';
  $("count").textContent = kw
    ? "匹配 " + shown + " / " + state.items.length + " 篇"
    : "共 " + state.items.length + " 篇";
}

/* ═══ 七、正文 ═══════════════════════════════════════════ */
var FISHTAIL = '<svg class="fishtail" width="42" height="18" viewBox="0 0 42 18" aria-hidden="true">' +
  '<path d="M13 5 L20 9 L13 13 Z" fill="#AE3225"/>' +
  '<path d="M29 5 L22 9 L29 13 Z" fill="#AE3225"/>' +
  '<line x1="0" y1="9" x2="11" y2="9" stroke="#C6BB9F" stroke-width="1"/>' +
  '<line x1="31" y1="9" x2="42" y2="9" stroke="#C6BB9F" stroke-width="1"/></svg>';

function currentHash() {
  var raw = location.hash.replace(/^#/, "");
  var i = raw.indexOf("/");
  var col = i < 0 ? "" : raw.slice(0, i);
  var key = i < 0 ? raw : raw.slice(i + 1);
  try { key = decodeURIComponent(key); } catch (e) { /* 保留原样 */ }
  return { col: col, key: key };
}

function go(idx, silent) {
  if (idx < 0 || idx >= state.items.length) return;
  var it = state.items[idx];
  var h = currentHash();
  if (h.col === state.col && h.key === it.key) { renderArticle(idx); return; }
  var frag = "#" + state.col + "/" + encodeURIComponent(it.key);
  if (silent) {
    history.replaceState(null, "", frag);
    renderArticle(idx);
  } else {
    location.hash = frag;
  }
}

function renderArticle(idx) {
  var it = state.items[idx];
  if (!it) return;
  var col = colById(state.col);
  if (!col) return;

  state.cur = idx;
  syncTabs();
  renderTOC($("q").value);

  var paper = $("paper");
  var ck = state.col + "/" + it.name;
  var token = ++state.req;
  var cached = state.cache[ck];

  if (cached === undefined) {
    paper.innerHTML = '<div class="loading">正在展开 ' + esc(it.label) + "</div>";
  }

  var p = cached !== undefined
    ? Promise.resolve(cached)
    : fetchText(col.dir + "/" + encodeURIComponent(it.name)).then(function (t) {
        state.cache[ck] = t;
        return t;
      });

  p.then(function (md) {
    if (token !== state.req) return;
    it._hay = md.toLowerCase();
    paper.innerHTML = paint(it, md, col);
    if ($("q").value.trim()) renderTOC($("q").value);
    document.title = it.title + " · " + CFG.title + col.label;
    window.scrollTo({ top: 0, behavior: "auto" });
    $("progress").style.width = "0%";
    closeRail();
    prefetch(idx);
  }).catch(function (err) {
    if (token !== state.req) return;
    paper.innerHTML =
      '<article class="article">' +
        '<div class="head-rule">' + FISHTAIL + '<span class="line"></span></div>' +
        '<div class="eyebrow">' + esc(CFG.title) + " · " + esc(col.label) + "</div>" +
        "<h1>读不到这一篇</h1>" +
        '<p class="tagline">' + esc(err && err.message ? err.message : String(err)) +
        "。请检查 <code>" + esc(col.dir) + "</code> 目录下是否还有 <code>" + esc(it.name) + "</code>。</p>" +
      "</article>";
  });
}

function paint(it, md, col) {
  var art = parseArticle(prettify(md));

  var prev = state.items[it.idx - 1], next = state.items[it.idx + 1];
  var pager = '<nav class="pager">' +
    (prev
      ? '<a class="pg prev" href="#' + state.col + "/" + encodeURIComponent(prev.key) + '"><span class="k">上一篇</span><span class="v">' + esc(prev.label + " · " + (prev.lead || prev.title)) + "</span></a>"
      : '<a class="pg prev" aria-disabled="true"><span class="k">上一篇</span><span class="v">已是首篇</span></a>') +
    (next
      ? '<a class="pg next" href="#' + state.col + "/" + encodeURIComponent(next.key) + '"><span class="k">下一篇</span><span class="v">' + esc(next.label + " · " + (next.lead || next.title)) + "</span></a>"
      : '<a class="pg next" aria-disabled="true"><span class="k">下一篇</span><span class="v">已是末篇</span></a>') +
    "</nav>";

  var h1 = inline(art.title).replace(/《([^》]+)》/, '<span class="bk">《$1》</span>');

  var other = otherCol(col.id);
  var xlink = "";
  if (other) {
    var mate = mateOf(other.id, it.order);
    var verb = col.id === "yuanwen" ? "对照导读" : "对照原文";
    xlink = mate
      ? '<a class="xlink" href="#' + mate.id + "/" + encodeURIComponent(mate.key) + '">' + verb + " ↗</a>"
      : '<span class="xlink" aria-disabled="true">暂无' + verb.slice(2) + "</span>";
  }

  var sealChars = col.id === "yuanwen" ? ["談", "藝", "原", "文"] : ["談", "藝", "導", "讀"];
  var seal = '<div class="seal" aria-hidden="true">' +
    sealChars.map(function (c) { return "<span>" + c + "</span>"; }).join("") + "</div>";

  var foot = state.mode === "live"
    ? "本地预览：新增或修改 markdown 后按 F5 刷新即可"
    : "静态站点：新增 markdown 后重新构建并推送即可";

  return '<article class="article">' +
      '<div class="head-rule">' + FISHTAIL + '<span class="line"></span>' + xlink + "</div>" +
      '<div class="eyebrow">' + esc(CFG.title) + " · " + esc(col.label) + " · " + esc(it.label) + "</div>" +
      "<h1>" + h1 + "</h1>" +
      (art.tag.length ? '<p class="tagline">' + inline(art.tag.join(" ")) + "</p>" : "") +
      renderBlocks(art.body.split("\n")) +
      pager +
      '<div class="colophon">' +
        '<div class="colo-text">' + esc(CFG.title) + " · " + esc(col.label) + " · 本篇完<br>" + esc(foot) + "</div>" +
        seal +
      "</div>" +
    "</article>";
}

/* 首屏只加载一篇，其余的排成一队慢慢取回。
   取回之后全文搜索才覆盖得到正文，翻页也不再等待。 */
function warmup() {
  var col = colById(state.col);
  if (!col) return;
  var gen = ++state.warm;
  var i = 0;
  function step() {
    if (gen !== state.warm || i >= state.items.length) return;
    var it = state.items[i++];
    var ck = state.col + "/" + it.name;
    if (state.cache[ck] !== undefined) { step(); return; }
    fetchText(col.dir + "/" + encodeURIComponent(it.name)).then(function (t) {
      state.cache[ck] = t;
      it._hay = t.toLowerCase();
      if ($("q").value.trim()) renderTOC($("q").value);
      step();
    }).catch(step);
  }
  setTimeout(step, 500);
}

/* 后台悄悄取来前后两篇，翻页时即刻可见 */
function prefetch(idx) {
  var col = colById(state.col);
  if (!col) return;
  [idx - 1, idx + 1].forEach(function (i) {
    var it = state.items[i];
    if (!it) return;
    var ck = state.col + "/" + it.name;
    if (state.cache[ck] !== undefined) return;
    fetchText(col.dir + "/" + encodeURIComponent(it.name)).then(function (t) {
      state.cache[ck] = t;
      it._hay = t.toLowerCase();
    }).catch(function () { /* 预取失败无所谓 */ });
  });
}

/* ═══ 八、空栏目 ═════════════════════════════════════════ */
function showEmpty(col) {
  $("paper").innerHTML =
    '<article class="article">' +
      '<div class="head-rule">' + FISHTAIL + '<span class="line"></span></div>' +
      '<div class="eyebrow">' + esc(CFG.title) + " · " + esc(col.label) + "</div>" +
      "<h1>这个栏目还是空的</h1>" +
      '<p class="tagline">把 <code>.md</code> 文件放进 <code>' + esc(col.dir) +
      "</code> 文件夹，刷新页面就会出现。文件名里写「第几节」即可自动排入目次。</p>" +
    "</article>";
}

/* ═══ 九、阅读偏好：字号 / 行宽 ══════════════════════════
   行宽以「每行字数」为单位（1em ≈ 一个汉字宽），所以调字号时
   每行字数不变，两个滑杆互不干扰。                        */
var PREF_KEY = "talesofart.reader.prefs";
var PREF_DEF = { fs: 17.5, mw: 38 };
var PREF_MIN = { fs: 15, mw: 22 };
var PREF_MAX = { fs: 24, mw: 52 };

function applyPrefs(fs, mw) {
  var s = document.documentElement.style;
  s.setProperty("--fs", fs + "px");
  s.setProperty("--measure", String(mw));
}

function readPrefs() {
  var p = { fs: PREF_DEF.fs, mw: PREF_DEF.mw };
  try {
    var o = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
    if (o) {
      if (typeof o.fs === "number" && o.fs >= PREF_MIN.fs && o.fs <= PREF_MAX.fs) p.fs = o.fs;
      if (typeof o.mw === "number" && o.mw >= PREF_MIN.mw && o.mw <= PREF_MAX.mw) p.mw = o.mw;
    }
  } catch (e) { /* 无痕模式等，用默认值 */ }
  return p;
}

function savePrefs(fs, mw) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ fs: fs, mw: mw })); } catch (e) { /* 忽略 */ }
}

function initPrefs() {
  var fsEl = $("fs"), mwEl = $("mw"), fsOut = $("fsv"), mwOut = $("mwv");

  function sync(save) {
    var fs = parseFloat(fsEl.value), mw = parseInt(mwEl.value, 10);
    fsOut.textContent = (fs % 1 ? fs.toFixed(1) : String(fs)) + " px";
    mwOut.textContent = mw + " 字";
    applyPrefs(fs, mw);
    if (save) savePrefs(fs, mw);
  }

  var p = readPrefs();
  fsEl.value = p.fs;
  mwEl.value = p.mw;
  sync(false);
  fsEl.addEventListener("input", function () { sync(true); });
  mwEl.addEventListener("input", function () { sync(true); });
  $("setReset").addEventListener("click", function () {
    fsEl.value = PREF_DEF.fs;
    mwEl.value = PREF_DEF.mw;
    sync(true);
  });
}

/* ═══ 十、交互 ═══════════════════════════════════════════ */
function closeRail() {
  $("rail").classList.remove("open");
  $("scrim").classList.remove("on");
}

function wire() {
  initPrefs();

  var rail = $("rail");
  $("railToggle").addEventListener("click", function () {
    rail.classList.toggle("open");
    $("scrim").classList.toggle("on", rail.classList.contains("open"));
  });
  $("scrim").addEventListener("click", closeRail);
  $("toc").addEventListener("click", function (e) {
    if (e.target.closest("a")) closeRail();
  });

  $("q").addEventListener("input", function (e) { renderTOC(e.target.value); });

  document.addEventListener("keydown", function (e) {
    var el = e.target, tag = (el.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea";
    if (e.key === "/" && !typing) { e.preventDefault(); $("q").focus(); return; }
    if (e.key === "Escape" && el.id === "q") { el.value = ""; renderTOC(""); el.blur(); return; }
    if (typing) return;
    if (e.key === "ArrowLeft" && state.cur > 0) go(state.cur - 1);
    if (e.key === "ArrowRight" && state.cur > -1 && state.cur < state.items.length - 1) go(state.cur + 1);
  });

  window.addEventListener("hashchange", function () {
    var h = currentHash();
    if (h.col && h.col !== state.col) { switchTo(h.col, h.key, true); return; }
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].key === h.key) { renderArticle(i); return; }
    }
    if (state.items.length) renderArticle(0);
  });

  window.addEventListener("scroll", function () {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    $("progress").style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
  }, { passive: true });
}

/* ═══ 十一、启动 ═════════════════════════════════════════ */
function fail(message, detail) {
  $("count").textContent = "载入失败";
  $("toc").innerHTML = '<div class="rail-empty">篇目清单读不出来。</div>';
  $("paper").innerHTML =
    '<article class="article">' +
      '<div class="head-rule">' + FISHTAIL + '<span class="line"></span></div>' +
      '<h1>站点还没有构建</h1>' +
      '<p class="tagline">' + esc(message) + "</p>" +
      '<div class="card">' + detail + "</div>" +
    "</article>";
}

Promise.all([loadConfig(), loadManifest()]).then(function (res) {
  CFG = res[0];
  MAN = res[1];
  wire();
  buildTabs();

  var h = currentHash();
  var start = colById(h.col) ? h.col : (colById(CFG.defaultCollection) ? CFG.defaultCollection : CFG.collections[0].id);
  switchTo(start, h.col ? h.key : null, true);
}).catch(function (err) {
  fail(String(err && err.message ? err.message : err),
    "<h2>在本地看</h2><p>双击根目录的 <code>start.bat</code>，浏览器会自动打开预览。</p>" +
    "<h2>发布到网上</h2><p>跑一次 <code>python tools/build.py</code>，把生成的内容推到 GitHub 即可。</p>");
});

})();