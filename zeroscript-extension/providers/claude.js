// SPDX-License-Identifier: GPL-3.0-or-later
// providers/claude.js - the Claude (claude.ai / claude.com) provider.
// Interface matches providers/deepseek.js. Selectors are kept in the S map
// below (with fallbacks) - if Anthropic reskins the page, adjust them there.
// Note: language-independent signals (data-testid / data-is-streaming) are
// preferred over aria-labels, because the UI may be localised.
// eslint-disable-next-line no-unused-vars
const ZSProvider = (() => {
  "use strict";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let diag = () => {};

  const S = {
    userItem: '[data-testid="user-message"], .font-user-message',
    // Claude's reply body. Older builds use .font-claude-message, newer ones
    // .font-claude-response - accept both.
    assistantItem: '.font-claude-response, .font-claude-message',
    // The composer is a ProseMirror contenteditable.
    editors: [
      'div.ProseMirror[contenteditable="true"]',
      '[data-testid="chat-input"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea',
    ],
    sendBtn: 'button[aria-label="Send message"], button[aria-label="Send Message"], button[aria-label="Send"]',
    stopBtn: 'button[aria-label="Stop response"], button[aria-label="Stop Response"], button[aria-label="Stop"]',
    // Set by the site on the message wrapper while a reply is streaming.
    streaming: '[data-is-streaming="true"]',
    thinking: '[data-testid="thinking"], .thinking-block',
  };

  const RE = {
    tooLong: /(conversation|chat) .{0,30}(too long|getting too long|length limit)|reached .{0,30}(message|length) limit/i,
    busy: /server is busy|please try again|system is currently busy|overloaded/i,
  };

  const timings = {
    GEN_IDLE_MS: 800,
    REASON_IDLE_MS: 6000,
    WARMUP_MS: 20000,
    STABLE_MS: 6000,
    RESPONSE_TIMEOUT_MS: 300000,
  };

  // ── Turns ──────────────────────────────────────────────────────
  // All chat turns in document order. A selector may match both a turn and a
  // nested element inside it, so keep only the outermost matches.
  const allItems = () => {
    const raw = [...document.querySelectorAll(`${S.userItem}, ${S.assistantItem}`)]
      .filter((e) => !e.closest('#zs-root'));
    return raw.filter((e) => !raw.some((o) => o !== e && o.contains(e)));
  };
  const isUserItem = (it) => !!it && it.matches(S.userItem);
  const isAssistantItem = (it) => !!it && !isUserItem(it);
  const assistantItems = () => allItems().filter(isAssistantItem);
  const assistantCount = () => assistantItems().length;
  const userCount = () => allItems().filter(isUserItem).length;
  const lastAssistant = () => {
    const it = assistantItems();
    return it.length ? it[it.length - 1] : null;
  };
  // Claude's list is not virtualised, so the core's positional fallback is
  // stable: no per-node id (a React remount must not look like a new turn).
  const itemKey = () => null;
  const chatIsEmpty = () => allItems().length === 0;
  const isChatUrl = () => /^\/chat\/[^/]+/.test(location.pathname);
  const isFreshChat = () => chatIsEmpty() && !!getEditor() && !isChatUrl();
  const conversationKey = () => (isChatUrl() ? location.pathname : '');

  // ── Composer ───────────────────────────────────────────────────
  // Try the known composer markup first, then progressively looser guesses, so
  // a small redesign of claude.ai does not leave the bar without an editor.
  // The composer is the LAST (bottom-most) match on the page.
  const isEditable = (e) => e.tagName === 'TEXTAREA' || e.isContentEditable;
  const isShown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const getEditor = () => {
    for (const sel of S.editors) {
      const list = [...document.querySelectorAll(sel)]
        .filter((e) => !e.closest('#zs-root') && isEditable(e) && isShown(e));
      if (list.length) return list[list.length - 1];
    }
    return null;
  };
  const editorText = () => {
    const e = getEditor();
    if (!e) return '';
    return e.tagName === 'TEXTAREA' ? e.value : (e.innerText || e.textContent || '');
  };

  function setInputLock(on) {
    const ed = getEditor();
    if (!ed) return;
    if (on) ed.setAttribute('data-zs-locked', '1');
    else ed.removeAttribute('data-zs-locked');
  }

  // The composer "card" = the nearest rounded ancestor of the editor that is
  // visibly a box (background / border / shadow). The bar is mounted INSIDE it,
  // at the top, so it looks like DeepSeek's. Falls back to the smallest ancestor
  // holding both the editor and the send button.
  function looksLikeCard(n) {
    let cs;
    try { cs = getComputedStyle(n); } catch { return false; }
    if ((parseFloat(cs.borderTopLeftRadius) || 0) < 12) return false;
    const bg = cs.backgroundColor || '';
    const hasBg = bg && bg !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg);
    const hasBorder = (parseFloat(cs.borderTopWidth) || 0) > 0 && cs.borderTopStyle !== 'none';
    const hasShadow = !!cs.boxShadow && cs.boxShadow !== 'none';
    return hasBg || hasBorder || hasShadow;
  }
  function composerFrame() {
    const ed = getEditor();
    if (!ed) return null;
    let n = ed.parentElement;
    for (let i = 0; i < 12 && n && n !== document.body; i++, n = n.parentElement) {
      if (looksLikeCard(n)) return n;
    }
    const send = document.querySelector(S.sendBtn);
    n = ed.parentElement;
    if (send) {
      while (n && n !== document.body && !n.contains(send)) n = n.parentElement;
      if (n && n !== document.body) return n;
    }
    return ed.closest('fieldset') || ed.parentElement?.parentElement?.parentElement || null;
  }
  // No barMount(): claude.ai is a React tree and a foreign node inserted into
  // the composer card gets re-parented / loses clicks. barAnchor() lets the core
  // keep the bar in its own #zs-root and hug the card's top edge instead.
  function barAnchor() { return composerFrame(); }

  // ── Reading replies ────────────────────────────────────────────
  // innerText keeps line breaks between paragraphs / code lines (textContent
  // glues them together), which the command parser relies on.
  function itemText(item) {
    return item ? (item.innerText || item.textContent || '') : '';
  }
  function classifyText(item) { return itemText(item); }

  function readAssistant() {
    const item = lastAssistant();
    if (!item) return { present: false, reply: '', thinking: '', item: null };
    const think = item.querySelector(S.thinking);
    return {
      present: true,
      reply: itemText(item).trim(),
      thinking: think ? (think.textContent || '').trim() : '',
      item,
    };
  }
  const streamLen = (item) => (item ? itemText(item).length : 0);
  function snapshot() { return { th: 0, rp: streamLen(lastAssistant()) }; }

  // ── Generation state ───────────────────────────────────────────
  const isHardGenerating = () => !!document.querySelector(S.streaming) || !!document.querySelector(S.stopBtn);
  const isGenerating = () => isHardGenerating();
  const isBusyNow = () => isHardGenerating();
  function genDebug() {
    return {
      streaming: !!document.querySelector(S.streaming),
      stopBtn: !!document.querySelector(S.stopBtn),
    };
  }
  function turnHalted() { return false; }
  function findContinueBtn() { return null; }
  function clickContinueBtn() { return false; }

  function scanError() {
    if (!getEditor()) return 'The input box disappeared (session ended?).';
    return null;
  }
  const isTooLongMsg = (t) => RE.tooLong.test(t);
  const isBusyMsg = (t) => RE.busy.test(t);

  // ── Sending ────────────────────────────────────────────────────
  const norm = (s) => (s || '').replace(/\s+/g, '');
  const gotText = (el, v) => norm(el.innerText || el.textContent).length >= norm(v).length * 0.9;

  // ProseMirror: insertText keeps long prompts as typed input (a paste of a
  // long text would be turned into a file attachment by claude.ai). If that
  // did not take, fall back to a synthetic paste, then to plain textContent.
  function setEditorText(el, v) {
    el.focus();
    if (el.tagName === 'TEXTAREA') {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    try { document.execCommand('insertText', false, v); } catch {}
    if (gotText(el, v)) return;
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', v);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch {}
    if (gotText(el, v)) return;
    el.textContent = v;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
  }

  function pressEnter(editor) {
    const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    editor.dispatchEvent(new KeyboardEvent('keydown', o));
    editor.dispatchEvent(new KeyboardEvent('keyup', o));
  }

  function clickSendButton() {
    const btn = document.querySelector(S.sendBtn);
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  }

  async function typeAndSend(text) {
    const editor = getEditor();
    if (!editor) throw new Error('Claude input box not found');
    setEditorText(editor, text);
    // The send button re-enables a moment after the text lands.
    for (let i = 0; i < 15; i++) {
      await sleep(120);
      const b = document.querySelector(S.sendBtn);
      if (b && !b.disabled) break;
    }
    if (!clickSendButton()) pressEnter(editor);
  }

  // Nothing to enforce on claude.ai (no model/mode picker we depend on).
  function enforceComposer() { return { ready: !!getEditor() }; }

  const PROMPT_EXTRA = [
    "You are running inside claude.ai. Do NOT use claude.ai's own features to do the work:",
    "no Artifacts, no code/analysis tool, no web search, no file creation, no connectors.",
    "Act ONLY by writing the ZeroScript command blocks described above, as plain text in your reply.",
    "Write one command block per reply, then stop and wait for the result.",
  ].join("\r\n");

  function stopGeneration() {
    const b = document.querySelector(S.stopBtn);
    if (b) try { b.click(); } catch {}
  }

  async function attachImages() { return false; }
  function clearAttachments() {}

  // ── Native send / stop hooks (so manual use is blocked before Start) ──
  function installSendHooks(handlers) {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      const editor = getEditor();
      if (!editor || !editor.contains(e.target)) return;
      if (editorText().trim() === '') return;
      if (handlers.isBlocked()) return;
      if (!handlers.isStarted()) { if (chatIsEmpty()) handlers.onBlockedAttempt(); return; }
      handlers.onUserMessage(assistantCount());
    }, true);
    document.addEventListener('click', (e) => {
      if (!getEditor()) return;
      const t = e.target;
      const stop = t && t.closest && t.closest(S.stopBtn);
      if (stop) { handlers.onNativeStop(); return; }
      const btn = t && t.closest && t.closest(S.sendBtn);
      if (!btn || btn.disabled) return;
      if (handlers.isBlocked()) return;
      if (!handlers.isStarted()) { if (chatIsEmpty()) handlers.onBlockedAttempt(); return; }
      handlers.onUserMessage(assistantCount());
    }, true);
  }

  // Hides the raw command block the model wrote (the JSON / ###LUA### block) so
  // only the ZeroScript chip shows. WITHOUT this the core sees "raw command
  // still visible" and rebuilds the chip on every sweep (visible flicker).
  // Returns {parent, ref} = where the chip goes (just before the first hidden
  // block), or null when the reply has no command block yet.
  function findToolBlockSpot(item, chip) {
    if (!item) return null;
    const isJson = (t) => /\{\s*"(?:command|tool)"\s*:/.test(t);
    const hasStart = (t) => /###\s*lua/i.test(t) || t.includes('###mcp_tool###');
    const hasEnd = (t) => /###\s*end[_ -]?lua/i.test(t) || /###end[_-]mcp_tool###/.test(t);
    const isThinking = (e) => !!e.closest(S.thinking);
    let containers = [...item.querySelectorAll('.standard-markdown, .progressive-markdown')]
      .filter((c) => !isThinking(c) && !c.closest('#zs-root'));
    // keep outermost only
    containers = containers.filter((c) => !containers.some((o) => o !== c && o.contains(c)));
    if (!containers.length) containers = [item];
    let parent = null, ref = null;
    for (const container of containers) {
      const kids = [...container.children].filter((k) => k !== chip && !(chip && k.contains(chip)) && !k.classList.contains('zs-chip'));
      let i = 0;
      while (i < kids.length) {
        const txt = kids[i].textContent || '';
        const startsBlock = hasStart(txt.toLowerCase());
        // The "Commands:" caption + the list under it is raw protocol text too: hide both.
        if (/^\s*commands\s*:/i.test(txt) && txt.length < 400) {
          kids[i].classList.add('zs-tool-hide');
          if (!ref && kids[i].parentElement) { parent = kids[i].parentElement; ref = kids[i]; }
          const nx = kids[i + 1];
          if (nx && /^(UL|OL)$/.test(nx.tagName)) { nx.classList.add('zs-tool-hide'); i += 2; } else i += 1;
          continue;
        }
        if (!startsBlock && !isJson(txt)) { i++; continue; }
        let runEnd = i;
        if (startsBlock && !hasEnd(txt.toLowerCase())) {
          runEnd = kids.length - 1;
          for (let j = i + 1; j < kids.length; j++) {
            if (hasEnd((kids[j].textContent || '').toLowerCase())) { runEnd = j; break; }
          }
        }
        for (let k = i; k <= runEnd; k++) {
          kids[k].classList.add('zs-tool-hide');
          if (!ref && kids[k].parentElement) { parent = kids[k].parentElement; ref = kids[k]; }
        }
        i = runEnd + 1;
      }
    }
    return ref ? { parent, ref } : null;
  }

  // Prints what the provider currently sees to the page console (F12), but only
  // when it changes. Lets a broken selector be found from a copy-paste.
  function describe(e) {
    if (!e) return null;
    const a = ['data-testid', 'role', 'aria-label'].map((k) => (e.getAttribute(k) ? `${k}=${e.getAttribute(k)}` : '')).filter(Boolean).join(' ');
    return `${e.tagName.toLowerCase()}${a ? ' [' + a + ']' : ''} .${String(e.className).slice(0, 60)}`;
  }
  function startConsoleReport() {
    let last = '';
    setInterval(() => {
      try {
        const fr = composerFrame();
        const rep = {
          path: location.pathname,
          editor: describe(getEditor()),
          send: describe(document.querySelector(S.sendBtn)),
          frame: fr ? `${describe(fr)} display=${getComputedStyle(fr).display}` : null,
          frameButtons: fr ? [...fr.querySelectorAll('button')].slice(0, 8).map(describe) : [],
          users: userCount(),
          assistants: assistantCount(),
          streamingAttr: document.querySelectorAll(S.streaming).length,
          stopBtn: !!document.querySelector(S.stopBtn),
          bar: !!document.getElementById('zs-bar'),
        };
        const j = JSON.stringify(rep);
        if (j !== last) { last = j; console.log('[ZS-claude]', j); }
      } catch (e) { console.log('[ZS-claude] report error', String(e)); }
    }, 2000);
  }

  return {
    id: 'claude',
    barNoPad: true,
    displayName: 'Claude',
    resendSystemEvery: 6,
    get supportsVision() { return false; },
    timings,
    promptExtra: PROMPT_EXTRA,
    thinkingSel: S.thinking,
    init({ diag: d } = {}) {
      if (d) diag = d;
      startConsoleReport();
      try { document.documentElement.setAttribute('data-zs-claude-ver', '2026-09'); } catch {}
    },
    allItems, isUserItem, isAssistantItem, itemText, classifyText,
    assistantCount, userCount, lastAssistant, itemKey, readAssistant,
    streamLen, snapshot,
    getEditor, editorText, chatIsEmpty, isFreshChat, composerFrame, barAnchor,
    setInputLock, typeAndSend, stopGeneration,
    isGenerating, isBusyNow, isHardGenerating, genDebug,
    enforceComposer,
    ensureComposerReady: async () => ({ ready: true }),
    turnHalted, findContinueBtn, clickContinueBtn,
    scanError, isTooLongMsg, isBusyMsg,
    attachImages, clearAttachments, conversationKey,
    installSendHooks, findToolBlockSpot,
  };
})();
