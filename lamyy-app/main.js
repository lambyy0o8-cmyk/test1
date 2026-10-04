// LamByy desktop - main process
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const WebSocket = require("ws");

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const BRIDGE_PORT = process.env.ZS_BRIDGE_PORT || "17613";
const BRIDGE_URL = `ws://127.0.0.1:${BRIDGE_PORT}`;

let win = null;
let ws = null;
let reqId = 1;
const pending = new Map(); // id -> {resolve}
let lastStatus = { connected: false };

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 480,
    backgroundColor: "#16161a",
    title: "LamByy System v7.3",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

// ── WebSocket к bridge.py ────────────────────────────────────────────────────
function connectBridge() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try { ws = new WebSocket(BRIDGE_URL); } catch (e) { return; }
  ws.on("open", () => { sendStatus({ connected: true }); });
  ws.on("message", (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }
    if (msg.type === "connected" || msg.type === "tools" || msg.type === "mcp_status") {
      lastStatus = {
        connected: true,
        mcpAlive: msg.mcp_alive,
        studio: msg.studio,
        studioApp: msg.studio_app,
        servers: msg.servers || lastStatus.servers || [],
        tools: Array.isArray(msg.tools) ? msg.tools.length : lastStatus.tools || 0,
      };
      sendStatus(lastStatus);
    }
    // Live-события для чипов в UI.
    if (msg.type === "ai_thinking" && msg.text) {
      sendEvent({ kind: "thinking", text: msg.text });
    }
    // Чип для каждого вызова тула (broadcast из bridge).
    if (msg.type === "tool_event") {
      sendEvent({ kind: "tool", name: msg.name || "tool", ok: msg.ok !== false,
                  error: msg.error || "", text: (msg.text || "").slice(0, 4000) });
    }
    const id = msg.id;
    if (id != null && pending.has(id)) {
      const p = pending.get(id);
      pending.delete(id);
      p.resolve(msg);
    }
  });
  ws.on("close", () => { sendStatus({ connected: false }); setTimeout(connectBridge, 2000); });
  ws.on("error", () => {});
}

function sendStatus(s) { if (win && !win.isDestroyed()) win.webContents.send("bridge-status", s); }
function sendEvent(e) { if (win && !win.isDestroyed()) win.webContents.send("bridge-event", e); }

function bridgeRequest(payload, timeoutMs = 300000) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) { resolve({ ok: false, error: "bridge offline" }); return; }
    const id = reqId++;
    const t = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: "timeout" }); }, timeoutMs);
    pending.set(id, { resolve: (m) => { clearTimeout(t); resolve(m); } });
    ws.send(JSON.stringify({ ...payload, id }));
  });
}

app.whenReady().then(() => {
  createWindow();
  connectBridge();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

ipcMain.handle("bridge-status", async () => lastStatus);

ipcMain.handle("open-log", async (_e, which) => {
  const f = which === "errors" ? "errors.log" : which === "actions" ? "ai_actions.log" : "bridge_debug.log";
  const p = path.join(LOG_DIR, f);
  if (fs.existsSync(p)) { shell.openPath(p); return { ok: true, path: p }; }
  return { ok: false, error: "not found: " + p };
});

ipcMain.handle("restart-bridge", async () => {
  const py = process.platform === "win32" ? "python" : "python3";
  const script = path.join(ROOT, "restart_bridge.py");
  if (!fs.existsSync(script)) return { ok: false, error: "restart_bridge.py not found" };
  const child = spawn(py, [script], { cwd: ROOT, detached: true, stdio: "ignore" });
  child.unref();
  return { ok: true };
});

// Чат через мост: deepseek_chat уходит в открытую вкладку DeepSeek.
ipcMain.handle("chat", async (_e, { text }) => {
  const r = await bridgeRequest({ type: "deepseek_chat", text }, 300000);
  if (!r || r.ok === false) {
    return { ok: false, error: (r && (r.error || r.text)) || "нет ответа от bridge/вкладки DeepSeek" };
  }
  return { ok: true, text: r.reply || r.text || "(пусто)" };
});
