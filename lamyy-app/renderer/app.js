// LamByy desktop - renderer
const $ = (id) => document.getElementById(id);
const chat = $("chat");
const input = $("input");
const send = $("send");
const jump = $("jump");

const nearBottom = () => chat.scrollHeight - chat.scrollTop - chat.clientHeight < 120;
function scrollDown(force) {
  if (force || nearBottom()) chat.scrollTop = chat.scrollHeight;
}
chat.addEventListener("scroll", () => { jump.hidden = nearBottom(); });
jump.addEventListener("click", () => { chat.scrollTop = chat.scrollHeight; });

// ── Сообщения ───────────────────────────────────────────────────────────────
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function rich(text) {
  return esc(text).split(/```[^\n]*\n?/).map((p, i) =>
    i % 2 ? `<pre><button type="button">Копировать</button><code>${p.replace(/\n$/, "")}</code></pre>`
          : p.replace(/`([^`\n]+)`/g, "<code>$1</code>")
  ).join("");
}
function flash(btn, label) {
  const old = btn.textContent; btn.textContent = label;
  setTimeout(() => (btn.textContent = old), 1200);
}

function addMsg(kind, text, force) {
  const d = document.createElement("div");
  d.className = "msg " + kind;
  if (kind === "sys") { d.textContent = text; }
  else {
    const tx = document.createElement("div");
    if (kind === "bot") tx.innerHTML = rich(text); else tx.textContent = text;
    d.appendChild(tx);
    const ft = document.createElement("div");
    ft.className = "msg-ft";
    const t = document.createElement("span");
    t.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const cp = document.createElement("button");
    cp.type = "button"; cp.textContent = "Копировать";
    cp.onclick = () => { navigator.clipboard.writeText(text); flash(cp, "Скопировано"); };
    ft.append(t, cp);
    d.appendChild(ft);
    d.querySelectorAll("pre").forEach((pre) => {
      const b = pre.querySelector("button");
      b.onclick = () => { navigator.clipboard.writeText(pre.querySelector("code").textContent); flash(b, "Скопировано"); };
    });
  }
  chat.appendChild(d);
  scrollDown(force || kind === "user");
  return d;
}

// ── Статус bridge ───────────────────────────────────────────────────────────
window.lambyy.onStatus((s) => {
  const dot = $("dot"), state = $("state"), servers = $("servers");
  servers.textContent = "";
  if (!s || !s.connected) {
    dot.className = "dot"; state.textContent = "Bridge: оффлайн";
    return;
  }
  const list = s.servers || [];
  const up = list.filter((x) => x.alive).length;
  const ok = s.connected && (s.mcpAlive || up > 0 || s.tools > 0);
  dot.className = "dot " + (ok ? "on" : "warn");
  state.textContent = ok ? `Bridge: подключён · ${s.tools || 0} tools` : "Bridge: Roblox не подключён";
  list.forEach((x) => {
    const r = document.createElement("div");
    r.className = "srv" + (x.alive ? " up" : "");
    r.innerHTML = '<i></i><span class="nm"></span><span class="n"></span>';
    r.querySelector(".nm").textContent = x.id;
    r.querySelector(".n").textContent = x.alive ? x.tools + " tools" : "down";
    servers.appendChild(r);
  });
});

// ── Чипы действий ───────────────────────────────────────────────────────────
const ICON = { run: '<span class="spin"></span>', ok: "✓", err: "⚠", think: "⋯" };

function addChip(name, phase, detail, body) {
  const d = document.createElement("div");
  d.className = "chip " + (phase === "run" ? "run" : phase === "err" ? "err" : "ok") + (body ? " has-body" : "");
  d.innerHTML =
    '<div class="chip-head">' +
      '<span class="chip-ic">' + (ICON[phase] || ICON.run) + "</span>" +
      '<span class="chip-tx"></span><span class="chip-dt"></span>' +
      (body ? '<span class="chip-cv">▾</span>' : "") +
    "</div>" +
    (body ? '<div class="chip-body"><pre></pre></div>' : "");
  d.querySelector(".chip-tx").textContent = name;
  if (detail) d.querySelector(".chip-dt").textContent = detail;
  if (body) {
    d.querySelector(".chip-body pre").textContent = body;
    d.querySelector(".chip-head").onclick = () => d.classList.toggle("open");
  }
  chat.appendChild(d);
  scrollDown();
  return d;
}

window.lambyy.onEvent((ev) => {
  if (!ev) return;
  if (ev.kind === "thinking") {
    const last = chat.lastElementChild;
    if (last && last.classList.contains("think")) {
      last.querySelector(".chip-dt").textContent = ev.text.slice(0, 90);
      last.querySelector(".chip-body pre").textContent = ev.text;
    } else {
      addChip("Думает", "think", ev.text.slice(0, 90), ev.text).classList.add("think");
    }
  } else if (ev.kind === "tool") {
    addChip(ev.name, ev.ok ? "ok" : "err", ev.ok ? "готово" : (ev.error || "ошибка"), ev.text || ev.error || "");
  }
});

// ── Кнопки функций ──────────────────────────────────────────────────────────
$("f-restart").addEventListener("click", async () => {
  addMsg("sys", "Перезапускаю bridge…");
  const r = await window.lambyy.restartBridge();
  addMsg("sys", r.ok ? "bridge перезапущен." : "Ошибка: " + r.error);
});
$("f-tools").addEventListener("click", async () => {
  const s = await window.lambyy.status();
  if (!s || !s.connected) { addMsg("err", "Bridge оффлайн — список команд недоступен."); return; }
  addMsg("sys", `Доступно tools: ${s.tools || 0}. Серверы: ` + (s.servers || []).map((x) => x.id).join(", "));
});
[["actions", "f-log-actions"], ["debug", "f-log-debug"], ["errors", "f-log-errors"]].forEach(([which, id]) =>
  $(id).addEventListener("click", async () => {
    const r = await window.lambyy.openLog(which);
    if (!r.ok) addMsg("err", "Лог не найден: " + r.error);
  })
);
$("f-clear").addEventListener("click", () => { chat.textContent = ""; addMsg("sys", "Чат очищен."); });

// ── Чат через мост → вкладка DeepSeek ──────────────────────────────────────
let busy = false;
async function doSend() {
  if (busy) return;
  const text = input.value.trim();
  if (!text) return;
  busy = true;
  input.value = "";
  input.style.height = "auto";
  addMsg("user", text);

  send.disabled = true;
  const pending = addChip("Ожидание ответа", "run", "", "");
  const r = await window.lambyy.chat({ text });
  pending.remove();
  if (r.ok) addMsg("bot", r.text); else addMsg("err", "Ошибка: " + r.error);
  send.disabled = false;
  busy = false;
  input.focus();
}

send.addEventListener("click", doSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

addMsg("sys", "LamByy System v7.3 — приложение запущено. Открой вкладку DeepSeek с расширением, потом пиши сюда.", true);
input.focus();