// ==UserScript==
// @name         DeepSeek Patcher (LamByy)
// @namespace    lambyy.deepseek.patcher
// @version      3.2.0
// @description  Индивидуальная правка любого сообщения. Правки сохраняются, кнопки можно скрыть.
// @match        https://chat.deepseek.com/*
// @match        https://chat.deepseek.com/
// @match        https://*.deepseek.com/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  const STORE_KEY   = 'lambyy_edits_v32';
  const ENABLED_KEY = 'lambyy_enabled_v32';
  const SHOWBTN_KEY = 'lambyy_showbtn_v32';
  const ORIGINAL = new WeakMap();

  function loadEdits() { try { const o = JSON.parse(GM_getValue(STORE_KEY,'{}')); return (o && typeof o === 'object') ? o : {}; } catch(e){ return {}; } }
  function saveEdits(o){ GM_setValue(STORE_KEY, JSON.stringify(o)); }
  function isEnabled(){ return GM_getValue(ENABLED_KEY, true); }
  function setEnabled(v){ GM_setValue(ENABLED_KEY, v); }
  function showBtns(){ return GM_getValue(SHOWBTN_KEY, true); }
  function setShowBtns(v){ GM_setValue(SHOWBTN_KEY, v); }

  function hashText(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i); return (h>>>0).toString(36); }

  const USER_TEXT_SEL = '.ds-collapsible-text';
  const ASSISTANT_TEXT_SEL = '.ds-assistant-message-main-content';

  function isUserNode(node){ return node.matches(USER_TEXT_SEL) && node.closest('.ds-message'); }
  function messageRole(node){ return isUserNode(node) ? 'user' : 'assistant'; }

  function buttonHost(node){
    if (isUserNode(node)) return node.closest('.ds-message') || node.parentElement;
    return node.parentElement || node;
  }

  function originalOf(node, key){
    if (ORIGINAL.has(node)) return ORIGINAL.get(node);
    const edits = loadEdits();
    if (key && edits[key] && typeof edits[key].orig === 'string') {
      ORIGINAL.set(node, edits[key].orig);
      return edits[key].orig;
    }
    return node.textContent;
  }

  function messageKey(node){
    const role = messageRole(node);
    const box = isUserNode(node) ? node.closest('.ds-message') : node;
    if (box && box.getAttribute){
      for (const a of ['data-message-id','data-id','id']){
        const v = box.getAttribute(a);
        if (v) return role + '|' + a + ':' + v;
      }
    }
    const orig = ORIGINAL.has(node) ? ORIGINAL.get(node) : node.textContent;
    return role + '|h:' + hashText(orig);
  }

  function findEntry(node){
    const edits = loadEdits();
    const key = messageKey(node);
    if (edits[key]) return { key, entry: edits[key] };
    const role = messageRole(node);
    const cur = ORIGINAL.has(node) ? ORIGINAL.get(node) : node.textContent;
    for (const k in edits){
      const e = edits[k];
      if (!e || typeof e.orig !== 'string') continue;
      if (!k.startsWith(role + '|')) continue;
      if (e.orig === cur) return { key: k, entry: e };
    }
    return { key, entry: null };
  }

  function findMessageNodes(root){
    const set = new Set();
    root.querySelectorAll(USER_TEXT_SEL).forEach(n => { if (n.closest('.ds-message')) set.add(n); });
    root.querySelectorAll(ASSISTANT_TEXT_SEL).forEach(n => set.add(n));
    return set;
  }

  function applyEdit(node){
    if (!isEnabled()) return;
    const { entry } = findEntry(node);
    if (entry && typeof entry.text === 'string'){
      if (!ORIGINAL.has(node)) ORIGINAL.set(node, entry.orig);
      if (node.textContent !== entry.text) node.textContent = entry.text;
      node.dataset.lambyyEdited = '1';
    } else {
      if (!ORIGINAL.has(node)) ORIGINAL.set(node, node.textContent);
      const orig = ORIGINAL.get(node);
      if (node.textContent !== orig) node.textContent = orig;
      delete node.dataset.lambyyEdited;
    }
  }

  // скрытие/показ всех кнопок ✎ через класс на <html>
  function applyButtonVisibility(){
    document.documentElement.classList.toggle('lambyy-hide-btns', !showBtns());
  }

  function ensureButton(node){
    const host = buttonHost(node);
    if (!host) return;
    if (host.querySelector(':scope > .lambyy-edit-btn')) return;
    if (host.dataset && host.dataset.lambyyBtn === '1') return;
    if (host.dataset) host.dataset.lambyyBtn = '1';

    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const role = messageRole(node);
    const color = role === 'user' ? '#7a5cc0' : '#2b6cb0';
    const btn = document.createElement('button');
    btn.className = 'lambyy-edit-btn';
    btn.textContent = '✎';
    btn.title = role==='user' ? 'Править моё сообщение (LamByy)' : 'Править ответ ассистента (LamByy)';
    const posCss = role === 'user' ? 'top:8px;left:-28px;' : 'top:4px;right:-28px;';
    btn.style.cssText = [
      'position:absolute', posCss, 'z-index:2147483647',
      'width:22px','height:22px','line-height:20px','text-align:center',
      'background:'+color,'color:#fff','border:0','border-radius:6px',
      'cursor:pointer','font-size:12px','opacity:.85'
    ].join(';');
    btn.addEventListener('mouseenter', ()=>btn.style.opacity='1');
    btn.addEventListener('mouseleave', ()=>btn.style.opacity='.85');
    btn.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); openEditor(node); });
    host.appendChild(btn);
  }

  function scan(root){
    findMessageNodes(root).forEach(n => {
      if (!n.textContent.trim().length) return;
      ensureButton(n);
      applyEdit(n);
    });
    applyButtonVisibility();
  }

  function openEditor(node){
    const { key, entry } = findEntry(node);
    const orig = originalOf(node, key);
    const role = messageRole(node);
    const current = entry ? entry.text : orig;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;display:flex;align-items:center;justify-content:center';
    const box = document.createElement('div');
    box.style.cssText = 'background:#12141a;color:#e8e8e8;font:13px/1.5 monospace;border:1px solid #2a2f3a;border-radius:10px;padding:14px;width:min(720px,92vw);box-shadow:0 8px 24px rgba(0,0,0,.6)';
    const roleLabel = role==='user' ? 'моё сообщение' : 'ответ ассистента';
    box.innerHTML =
      '<div style="font-weight:700;margin-bottom:8px;color:#e6c07b">LamByy — правка (' + roleLabel + ')</div>' +
      '<div style="color:#8a8f99;margin-bottom:6px">Ключ: <code>' + key.replace(/</g,'&lt;') + '</code></div>' +
      '<textarea id="lambyy-ta" style="width:100%;min-height:220px;background:#0b0d12;color:#d7d7d7;border:1px solid #2a2f3a;border-radius:6px;padding:8px;font:13px/1.5 monospace"></textarea>' +
      '<div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end">' +
      '<button id="lambyy-reset" style="background:#5a2a2a;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer">Сбросить</button>' +
      '<button id="lambyy-cancel" style="background:#333;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer">Отмена</button>' +
      '<button id="lambyy-save" style="background:#2b6cb0;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer">Сохранить</button>' +
      '</div>';
    wrap.appendChild(box); document.body.appendChild(wrap);

    const ta = box.querySelector('#lambyy-ta');
    ta.value = current; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    const close = () => wrap.remove();
    box.querySelector('#lambyy-cancel').addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    document.addEventListener('keydown', function esc(e){ if (e.key==='Escape'){ close(); document.removeEventListener('keydown', esc); } });

    box.querySelector('#lambyy-reset').addEventListener('click', () => {
      const ed = loadEdits(); delete ed[key]; saveEdits(ed);
      if (node.textContent !== orig) node.textContent = orig;
      delete node.dataset.lambyyEdited; close();
    });

    box.querySelector('#lambyy-save').addEventListener('click', () => {
      const val = ta.value; const ed = loadEdits();
      if (val === orig) delete ed[key]; else ed[key] = { orig: orig, text: val };
      saveEdits(ed);
      if (!ORIGINAL.has(node)) ORIGINAL.set(node, orig);
      node.textContent = val;
      if (val === orig) delete node.dataset.lambyyEdited; else node.dataset.lambyyEdited = '1';
      close();
    });
  }

  const obs = new MutationObserver(muts => {
    for (const m of muts){
      m.addedNodes && m.addedNodes.forEach(n => { if (n.nodeType === 1) scan(n); });
      if (m.type === 'characterData' && m.target.parentElement) scan(m.target.parentElement);
    }
  });

  function start(){
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    scan(document.body);
    setTimeout(() => scan(document.body), 800);
    setTimeout(() => scan(document.body), 2000);
    setTimeout(() => scan(document.body), 5000);
  }

  function makePanel(){
    const box = document.createElement('div');
    box.id = 'lambyy-panel';
    box.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#12141a;color:#e8e8e8;font:12px/1.4 monospace;border:1px solid #2a2f3a;border-radius:10px;padding:10px 12px;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.5)';
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<div style="font-weight:700;color:#e6c07b">LamByy Patcher v3.2</div>' +
        '<button id="lambyy-collapse" title="Свернуть" style="background:transparent;color:#e6c07b;border:0;cursor:pointer;font-size:14px;line-height:1">▾</button>' +
      '</div>' +
      '<div id="lambyy-body">' +
        '<label style="display:block"><input type="checkbox" id="lambyy-on"> включено</label>' +
        '<label style="display:block;margin-top:4px"><input type="checkbox" id="lambyy-showbtn"> показывать кнопки ✎</label>' +
        '<div style="margin-top:6px;color:#8a8f99">Правки хранятся в Tampermonkey и восстанавливаются после F5. Скрытие кнопок не отключает подмену — правки применяются всегда.</div>' +
        '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<button id="lambyy-export" style="background:#333;color:#fff;border:0;border-radius:6px;padding:4px 8px;cursor:pointer">Экспорт</button>' +
        '<button id="lambyy-import" style="background:#333;color:#fff;border:0;border-radius:6px;padding:4px 8px;cursor:pointer">Импорт</button>' +
        '<button id="lambyy-clear" style="background:#5a2a2a;color:#fff;border:0;border-radius:6px;padding:4px 8px;cursor:pointer">Очистить</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(box);

    // сворачивание панели
    const collapse = box.querySelector('#lambyy-collapse');
    const body = box.querySelector('#lambyy-body');
    let collapsed = GM_getValue('lambyy_collapsed_v32', false);
    if (collapsed){ body.style.display = 'none'; collapse.textContent = '▸'; }
    collapse.addEventListener('click', () => {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : 'block';
      collapse.textContent = collapsed ? '▸' : '▾';
      GM_setValue('lambyy_collapsed_v32', collapsed);
    });

    const on = box.querySelector('#lambyy-on'); on.checked = isEnabled();
    on.addEventListener('change', () => {
      setEnabled(on.checked);
      if (!on.checked) findMessageNodes(document.body).forEach(n => { if (ORIGINAL.has(n)) n.textContent = ORIGINAL.get(n); });
      else scan(document.body);
    });

    const showBtn = box.querySelector('#lambyy-showbtn'); showBtn.checked = showBtns();
    showBtn.addEventListener('change', () => {
      setShowBtns(showBtn.checked);
      applyButtonVisibility();
    });

    box.querySelector('#lambyy-export').addEventListener('click', () => {
      const data = JSON.stringify(loadEdits(), null, 2);
      navigator.clipboard.writeText(data).then(() => alert('Скопировано'), () => alert('Не удалось. Данные:\n' + data));
    });
    box.querySelector('#lambyy-import').addEventListener('click', () => {
      const s = prompt('JSON с правками:'); if (!s) return;
      try { const o = JSON.parse(s); if (typeof o!=='object'||Array.isArray(o)) throw new Error('нужен объект'); saveEdits(o); scan(document.body); alert('Импортировано'); }
      catch(e){ alert('Ошибка: '+e.message); }
    });
    box.querySelector('#lambyy-clear').addEventListener('click', () => {
      if (!confirm('Удалить все правки?')) return;
      saveEdits({});
      findMessageNodes(document.body).forEach(n => { if (ORIGINAL.has(n)) n.textContent = ORIGINAL.get(n); delete n.dataset.lambyyEdited; });
    });
  }

  // CSS-правило для скрытия кнопок
  const styleEl = document.createElement('style');
  styleEl.textContent = '.lambyy-hide-btns .lambyy-edit-btn { display: none !important; }';
  (document.head || document.documentElement).appendChild(styleEl);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { start(); makePanel(); });
  else { start(); makePanel(); }
})();
