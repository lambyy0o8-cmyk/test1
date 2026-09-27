import json
import os
import sys
import subprocess
import shutil
from pathlib import Path

# ZeroScript VS Code MCP server with selectable workspace root.
# The root can be changed at runtime with the set_workspace tool.

workspace_root = Path(os.environ.get("ZS_VSCODE_ROOT", os.getcwd())).resolve()

# When True, safe_path() accepts absolute paths outside workspace_root (used by
# the extension's "Allow writes outside folder" checkbox). The flag is stored in
# a small JSON file next to this script so the setting survives a restart.
_SETTINGS_PATH = Path(__file__).with_name("vscode_settings.json")
allow_outside = False


def _load_settings():
    global allow_outside
    try:
        data = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
        allow_outside = bool(data.get("allow_outside", False))
    except Exception:
        allow_outside = False


def _save_settings():
    try:
        _SETTINGS_PATH.write_text(
            json.dumps({"allow_outside": allow_outside}), encoding="utf-8")
    except Exception:
        pass


_load_settings()


def send(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def read_message():
    line = sys.stdin.readline()
    if not line:
        return None
    try:
        return json.loads(line)
    except Exception:
        return None


def safe_path(path):
    p = Path(path)
    if not p.is_absolute():
        p = workspace_root / p
    p = p.resolve()
    if not allow_outside:
        try:
            p.relative_to(workspace_root)
        except ValueError:
            raise PermissionError(
                f"Path is outside the workspace folder: {p}. "
                "Enable 'Allow writes outside folder' to permit this."
            )
    return p


def result(req_id, value):
    send({"jsonrpc": "2.0", "id": req_id, "result": value})


def error(req_id, code, message):
    send({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})


def tool(name, description, schema):
    return {
        "name": name,
        "description": description,
        "inputSchema": schema,
    }


TOOLS = [
    tool("get_workspace", "Get the currently selected VS Code workspace folder.", {
        "type": "object", "properties": {}, "additionalProperties": False
    }),
    tool("get_settings", "Get the VS Code MCP settings, e.g. whether writes outside the workspace folder are allowed.", {
        "type": "object", "properties": {}, "additionalProperties": False
    }),
    tool("set_settings", "Update VS Code MCP settings (e.g. allow_outside).", {
        "type": "object", "properties": {
            "allow_outside": {"type": "boolean", "description": "Allow file operations on absolute paths outside the workspace folder."}
        }, "additionalProperties": False
    }),
    tool("pick_folder", "Open the native Windows folder picker and return the chosen absolute path (or CANCELLED).", {
        "type": "object", "properties": {
            "description": {"type": "string", "description": "Optional dialog title."}
        }, "additionalProperties": False
    }),
    tool("set_workspace", "Change the folder that all VS Code file operations use. Accepts an absolute Windows path or another absolute path.", {
        "type": "object", "properties": {
            "path": {"type": "string", "description": "Absolute path to the folder to use as the workspace."}
        }, "required": ["path"], "additionalProperties": False
    }),
    tool("create_file", "Create or overwrite a file inside the selected workspace.", {
        "type": "object", "properties": {
            "path": {"type": "string"}, "content": {"type": "string"}, "overwrite": {"type": "boolean"}
        }, "required": ["path", "content"], "additionalProperties": False
    }),
    tool("edit_file", "Make a precise text replacement in an existing file.", {
        "type": "object", "properties": {
            "path": {"type": "string"}, "old_string": {"type": "string"}, "new_string": {"type": "string"}, "expected_replacements": {"type": "integer"}
        }, "required": ["path", "old_string", "new_string"], "additionalProperties": False
    }),
    tool("delete_file", "Delete a specific file or folder.", {
        "type": "object", "properties": {
            "path": {"type": "string"}, "recursive": {"type": "boolean"}
        }, "required": ["path"], "additionalProperties": False
    }),
    tool("move_file", "Rename or move a file or folder.", {
        "type": "object", "properties": {
            "source": {"type": "string"}, "destination": {"type": "string"}
        }, "required": ["source", "destination"], "additionalProperties": False
    }),
    tool("create_folder", "Create a folder inside the selected workspace.", {
        "type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"], "additionalProperties": False
    }),
    tool("list_files", "List files and folders in the selected workspace.", {
        "type": "object", "properties": {"path": {"type": "string"}, "max_depth": {"type": "integer"}}, "additionalProperties": False
    }),
    tool("read_file", "Read a UTF-8 text file.", {
        "type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"], "additionalProperties": False
    }),
    tool("search_in_files", "Search text or regular expressions across files.", {
        "type": "object", "properties": {
            "query": {"type": "string"}, "regex": {"type": "boolean"}, "case_sensitive": {"type": "boolean"}, "path": {"type": "string"}, "max_results": {"type": "integer"}
        }, "required": ["query"], "additionalProperties": False
    }),
    tool("run_python", "Run a Python file from the selected workspace.", {
        "type": "object", "properties": {"path": {"type": "string"}, "timeout": {"type": "number"}}, "required": ["path"], "additionalProperties": False
    }),
    tool("run_command", "Run a terminal command with the selected workspace as the working directory.", {
        "type": "object", "properties": {"command": {"type": "string"}, "timeout": {"type": "number"}}, "required": ["command"], "additionalProperties": False
    }),
    tool("run_detached", "Run a terminal command WITHOUT waiting for it to finish. Use for launching GUI apps (Discord, launchers, games) so the bridge is never blocked.", {
        "type": "object", "properties": {"command": {"type": "string"}, "timeout": {"type": "number"}}, "required": ["command"], "additionalProperties": False
    }),
    tool("run_args", "Run a program with an argument ARRAY (no shell quoting headaches). Example: program='python.exe', args=['script.py','a b','c'].", {
        "type": "object", "properties": {
            "program": {"type": "string"},
            "args": {"type": "array", "items": {"type": "string"}},
            "timeout": {"type": "number"}
        }, "required": ["program"], "additionalProperties": False
    }),
    tool("screenshot", "Capture a PNG of a window (by title substring) or the whole screen, and RETURN IT AS AN IMAGE so the agent can actually see it. Optionally also OCR it.", {
        "type": "object", "properties": {
            "window": {"type": "string", "description": "Case-insensitive substring of the window title. Omit to capture the whole screen."},
            "save": {"type": "string", "description": "Optional path to also save the PNG to."},
            "ocr": {"type": "boolean", "description": "If true, also run Tesseract and append recognised text (text|x|y) after the image."}
        }, "additionalProperties": False
    }),
    tool("format_code", "Format a supported source file using available formatters.", {
        "type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"], "additionalProperties": False
    }),
    tool("run_tests", "Run pytest in the selected workspace.", {
        "type": "object", "properties": {"args": {"type": "array", "items": {"type": "string"}}, "timeout": {"type": "number"}}, "additionalProperties": False
    }),
    tool("git_status", "Show Git status.", {"type": "object", "properties": {}, "additionalProperties": False}),
    tool("git_init", "Initialize a Git repository.", {"type": "object", "properties": {}, "additionalProperties": False}),
    tool("git_commit", "Stage selected files and create a Git commit.", {
        "type": "object", "properties": {"message": {"type": "string"}, "files": {"type": "array", "items": {"type": "string"}}}, "required": ["message"], "additionalProperties": False
    }),
    tool("npm_install", "Run npm install in the selected workspace.", {
        "type": "object", "properties": {"args": {"type": "array", "items": {"type": "string"}}, "timeout": {"type": "number"}}, "additionalProperties": False
    }),
    tool("install_packages", "Install Python packages with pip.", {
        "type": "object", "properties": {"packages": {"type": "array", "items": {"type": "string"}}}, "required": ["packages"], "additionalProperties": False
    }),
    tool("find_program", "Find an executable / app by name anywhere on this PC (Program Files, LocalAppData, PATH, Start Menu shortcuts, Steam libraries, Desktop, Downloads). Use this BEFORE run_detached / run_command when the user names an app (e.g. 'Real.exe', 'Discord', 'Roblox Account Manager') so you do not have to guess its full path. Returns the best matching full path(s), newest first.", {
        "type": "object", "properties": {
            "name": {"type": "string", "description": "Name to search for, with or without .exe (e.g. 'Real', 'Real.exe', 'Discord'). Case-insensitive."},
            "max_results": {"type": "integer", "description": "How many matches to return (default 10)."}
        }, "required": ["name"], "additionalProperties": False
    }),
    tool("list_programs", "List launchable programs found on this PC (a broad scan of Program Files, LocalAppData, PATH, Start Menu, Steam libraries). Optionally filter by a substring. Use when you are not sure of the exact app name.", {
        "type": "object", "properties": {
            "filter": {"type": "string", "description": "Optional case-insensitive substring to filter the list (e.g. 'roblox', 'discord')."},
            "max_results": {"type": "integer", "description": "How many results to return (default 100)."}
        }, "additionalProperties": False
    })
]


def list_tree(base, max_depth):
    base = safe_path(base)
    if not base.exists():
        raise FileNotFoundError(str(base))
    if not base.is_dir():
        raise NotADirectoryError(str(base))
    lines = []
    root_depth = len(base.parts)
    for current, dirs, files in os.walk(base):
        current_p = Path(current)
        depth = len(current_p.parts) - root_depth
        if depth >= max_depth:
            dirs[:] = []
        dirs.sort()
        files.sort()
        for d in dirs:
            rel = current_p / d
            lines.append(str(rel.relative_to(base)).replace(os.sep, "/") + "/")
        for f in files:
            rel = current_p / f
            try:
                size = rel.stat().st_size
            except OSError:
                size = 0
            lines.append(f"{str(rel.relative_to(base)).replace(os.sep, '/')} ({size} bytes)")
    return "\n".join(lines)


def run_process(cmd, cwd=None, timeout=120):
    p = subprocess.run(cmd, cwd=str(cwd or workspace_root), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    out = p.stdout
    err = p.stderr
    return f"Exit code: {p.returncode}\n" + (out if out else "") + (err if err else "")


def run_command_detached(command, cwd=None, probe_timeout=8):
    """Run a shell command but NEVER block the MCP server on it.

    The problem this solves: subprocess.run() above waits for the command to
    finish. That is fine for `dir`, `git status` and other quick commands, but
    when the command LAUNCHES A GUI APP (Discord, a launcher, a game) the app
    stays open forever, so run() never returns - the bridge stays blocked on
    that one tool call and the user cannot send anything else until the app is
    closed (seen live: 'Roblox Account Manager' hung the whole loop).

    So: start the command, wait a SHORT probe window for it to finish. If it
    finishes inside that window, return its real output. If it is still running
    after the probe, DON'T wait any longer and DON'T kill it - report that it
    is running in the background and return control immediately.
    """
    import time as _time
    try:
        proc = subprocess.Popen(
            command,
            cwd=str(cwd or workspace_root),
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except Exception as e:
        return f"Failed to start: {e}"
    deadline = _time.monotonic() + probe_timeout
    while _time.monotonic() < deadline:
        if proc.poll() is not None:
            break
        _time.sleep(0.1)
    if proc.poll() is None:
        # Still running after the probe window - a long-lived / GUI process.
        # Leave it alive on purpose and hand control back to the agent.
        return ("Started in the background (still running after "
                f"{probe_timeout}s) - NOT waiting for it to exit. "
                "Command: " + str(command))
    out, err = proc.communicate()
    return f"Exit code: {proc.returncode}\n" + (out or "") + (err or "")


def build_screenshot_content(window=None, save=None, ocr=False):
    """Capture a window (by title substring) or the whole screen and return it
    as MCP content: an image block the agent can actually SEE, plus optional
    OCR text. Runs the capture through the Python 3.11 interpreter because
    pyautogui / pytesseract live there, not in this server's 3.15."""
    py311 = r"C:\Users\lamby\AppData\Local\Programs\Python\Python311\python.exe"
    helper = Path(__file__).with_name("_grab.py")
    out_png = save or str(Path(__file__).with_name("_grab.png"))
    cmd = [py311, str(helper), "--out", out_png]
    if window:
        cmd += ["--window", window]
    if ocr:
        cmd += ["--ocr"]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=60)
    except Exception as e:
        return [{"type": "text", "text": f"screenshot failed: {e}"}]
    content = []
    text = (p.stdout or "") + (p.stderr or "")
    if text.strip():
        content.append({"type": "text", "text": text.strip()})
    try:
        import base64
        data = Path(out_png).read_bytes()
        content.append({"type": "image", "data": base64.b64encode(data).decode("ascii"),
                        "mimeType": "image/png"})
    except Exception as e:
        content.append({"type": "text", "text": f"(could not attach image: {e})"})
    return content


def _search_roots():
    """Every place on this PC an .exe is likely to live, in priority order.
    Used by find_programs / scan_programs so the agent does not have to walk
    the whole drive: a name like 'Real.exe' almost always resolves inside the
    first handful of these."""
    home = Path(os.path.expanduser("~"))
    local = home / "AppData" / "Local"
    roaming = home / "AppData" / "Roaming"
    roots = [
        Path(r"C:\Program Files"),
        Path(r"C:\Program Files (x86)"),
        local / "Programs",
        local,
        roaming,
        home / "Desktop",
        home / "Downloads",
        home / "Documents",
        home / "OneDrive" / "Desktop",
        Path(r"C:\ProgramData"),
    ]
    # Steam libraries (default install + any extra library folders declared in
    # libraryfolders.vdf). Cheap to read, and covers 'launcher'-style apps that
    # live inside steamapps/common.
    steam_default = Path(r"C:\Program Files (x86)\Steam\steamapps\common")
    if steam_default.is_dir():
        roots.append(steam_default)
    for vdf in (Path(r"C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf"),
                Path(r"C:\Program Files\Steam\steamapps\libraryfolders.vdf")):
        try:
            for line in vdf.read_text(encoding="utf-8", errors="replace").splitlines():
                line = line.strip()
                if line.lower().startswith('"path"'):
                    p = line.split('"')[3] if line.count('"') >= 4 else None
                    if p:
                        common = Path(p) / "steamapps" / "common"
                        if common.is_dir():
                            roots.append(common)
        except Exception:
            pass
    # Anything directly on PATH (covers portable installs).
    for d in os.environ.get("PATH", "").split(os.pathsep):
        if d:
            roots.append(Path(d))
    # De-dup while keeping order, drop non-existent / non-dirs.
    seen = set()
    out = []
    for r in roots:
        try:
            r = r.resolve()
        except Exception:
            continue
        if r in seen or not r.is_dir():
            continue
        seen.add(r)
        out.append(r)
    return out


def _shortcut_targets():
    """Map of .lnk name -> target .exe for Start Menu / Desktop shortcuts.
    Shortcut NAMES are how a user thinks of an app ('Roblox Account Manager')
    while the real exe often has a different name - reading them here lets
    find_programs match either one."""
    home = Path(os.path.expanduser("~"))
    menu_dirs = [
        home / "AppData" / "Roaming" / "Microsoft" / "Windows" / "Start Menu" / "Programs",
        Path(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs"),
        home / "Desktop",
        home / "OneDrive" / "Desktop",
    ]
    out = {}
    try:
        import ctypes
        import ctypes.wintypes  # noqa: F401
    except Exception:
        return out
    for d in menu_dirs:
        if not d.is_dir():
            continue
        for lnk in d.rglob("*.lnk"):
            try:
                # COM-free shortcut target read via the Shell link through
                # PowerShell is slow; instead resolve through the WScript
                # Shell COM object once here - cheaper than spawning PS per lnk.
                pass
            except Exception:
                continue
    # Resolve all .lnk files in one PowerShell pass (fast, one process).
    try:
        dirs_arg = ";".join(str(d) for d in menu_dirs if d.is_dir())
        if not dirs_arg:
            return out
        ps = (
            "$s = New-Object -ComObject WScript.Shell; "
            f"Get-ChildItem -Path @({','.join(repr(str(d)) for d in menu_dirs if d.is_dir())}) -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | "
            "ForEach-Object { $t = $s.CreateShortcut($_.FullName).TargetPath; "
            "if ($t) { Write-Output ($_.Name + '|' + $t) } }"
        )
        p = subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=20)
        for line in (p.stdout or "").splitlines():
            if "|" in line:
                nm, tgt = line.split("|", 1)
                nm = nm.strip()
                tgt = tgt.strip()
                if nm and tgt.lower().endswith(".exe"):
                    out[nm] = tgt
    except Exception:
        pass
    return out


def scan_programs(filter_str="", limit=100):
    """All launchable .exe files under the search roots, optionally filtered
    by a case-insensitive substring. Returns 'name -> full_path' lines,
    deduped by resolved path, sorted by name."""
    flt = (filter_str or "").lower()
    found = {}
    for root in _search_roots():
        try:
            for dirpath, dirnames, filenames in os.walk(root):
                # Skip obvious junk so a full scan stays fast.
                low = dirpath.lower()
                if any(s in low for s in ("\\windows\\", "\\$recycle", "\\node_modules", "\\.git")):
                    dirnames[:] = []
                    continue
                for fn in filenames:
                    if not fn.lower().endswith(".exe"):
                        continue
                    if flt and flt not in fn.lower():
                        continue
                    fp = Path(dirpath) / fn
                    try:
                        key = str(fp.resolve())
                    except Exception:
                        key = str(fp)
                    if key not in found:
                        found[key] = fn
        except Exception:
            continue
    lines = [f"{name} -> {path}" for path, name in found.items()]
    lines.sort(key=lambda s: s.lower())
    return lines[:limit]


def find_programs(name, limit=10):
    """Best-effort locate of an app by name. Matches against the exe filename
    AND against Start Menu shortcut names, so 'Roblox Account Manager' works
    even though the exe is called something else. Scores exact stems first,
    then prefix, then substring. Returns 'name -> full_path (via shortcut)'
    lines, best first."""
    raw = (name or "").strip()
    if not raw:
        return []
    stem = raw[:-4] if raw.lower().endswith(".exe") else raw
    stem_l = stem.lower()
    hits = {}  # resolved path -> (display_name, score)

    # 1. Shortcuts first - a shortcut's display name is the friendliest match.
    for lnk_name, target in _shortcut_targets().items():
        ln = lnk_name.lower()
        t_stem = Path(target).stem.lower()
        score = None
        if ln == stem_l or ln == stem_l + ".lnk" or t_stem == stem_l:
            score = 100
        elif ln.startswith(stem_l) or t_stem.startswith(stem_l):
            score = 70
        elif stem_l in ln or stem_l in t_stem:
            score = 40
        if score is None:
            continue
        try:
            key = str(Path(target).resolve())
        except Exception:
            key = target
        prev = hits.get(key)
        if prev is None or score > prev[1]:
            hits[key] = (lnk_name, score)

    # 2. Direct .exe scan (catches portable / no-shortcut installs).
    for root in _search_roots():
        try:
            for dirpath, dirnames, filenames in os.walk(root):
                low = dirpath.lower()
                if any(s in low for s in ("\\windows\\", "\\$recycle", "\\node_modules", "\\.git")):
                    dirnames[:] = []
                    continue
                for fn in filenames:
                    if not fn.lower().endswith(".exe"):
                        continue
                    fn_l = fn.lower()
                    s = fn_l[:-4]
                    score = None
                    if s == stem_l:
                        score = 100
                    elif s.startswith(stem_l):
                        score = 70
                    elif stem_l in s:
                        score = 40
                    if score is None:
                        continue
                    fp = Path(dirpath) / fn
                    try:
                        key = str(fp.resolve())
                    except Exception:
                        key = str(fp)
                    prev = hits.get(key)
                    if prev is None or score > prev[1]:
                        hits[key] = (fn, score)
        except Exception:
            continue

    ranked = sorted(hits.items(), key=lambda kv: (-kv[1][1], kv[0].lower()))
    out = []
    for path, (disp, score) in ranked[:limit]:
        tag = " (via shortcut)" if disp.lower().endswith(".lnk") else ""
        out.append(f"{disp}{tag} -> {path}")
    return out


def handle(req):
    global workspace_root
    global allow_outside
    req_id = req.get("id")
    method = req.get("method")
    params = req.get("params") or {}

    if method == "initialize":
        result(req_id, {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "zeroscript-vscode", "version": "2.0.0"}
        })
        return

    if method == "notifications/initialized":
        return

    if method == "tools/list":
        result(req_id, {"tools": TOOLS})
        return

    if method != "tools/call":
        error(req_id, -32601, f"Unknown method: {method}")
        return

    name = params.get("name")
    args = params.get("arguments") or {}

    try:
        if name == "get_workspace":
            result(req_id, {"content": [{"type": "text", "text": str(workspace_root)}]})
            return

        if name == "get_settings":
            result(req_id, {"content": [{"type": "text", "text": json.dumps({"allow_outside": allow_outside})}]})
            return

        if name == "set_settings":
            if "allow_outside" in args:
                allow_outside = bool(args["allow_outside"])
                _save_settings()
            result(req_id, {"content": [{"type": "text", "text": json.dumps({"allow_outside": allow_outside})}]})
            return

        if name == "pick_folder":
            title = args.get("description", "Select workspace folder")
            ps = (
                "Add-Type -AssemblyName System.Windows.Forms; "
                "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
                f"$f.Description = '{title}'; "
                "$f.ShowNewFolderButton = $true; "
                "if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath } else { 'CANCELLED' }"
            )
            out = subprocess.run(
                ["powershell", "-NoProfile", "-STA", "-Command", ps],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                timeout=300,
            ).stdout.strip()
            result(req_id, {"content": [{"type": "text", "text": out or "CANCELLED"}]})
            return

        if name == "set_workspace":
            p = Path(args["path"]).expanduser().resolve()
            if not p.exists():
                raise FileNotFoundError(f"Folder does not exist: {p}")
            if not p.is_dir():
                raise NotADirectoryError(f"Not a folder: {p}")
            workspace_root = p
            result(req_id, {"content": [{"type": "text", "text": f"Workspace changed to: {workspace_root}"}]})
            return

        if name == "list_files":
            base = args.get("path", ".")
            depth = int(args.get("max_depth", 3))
            result(req_id, {"content": [{"type": "text", "text": list_tree(base, depth)}]})
            return

        if name == "read_file":
            p = safe_path(args["path"])
            text = p.read_text(encoding="utf-8")
            result(req_id, {"content": [{"type": "text", "text": text}]})
            return

        if name == "create_file":
            p = safe_path(args["path"])
            if p.exists() and not args.get("overwrite", False):
                raise FileExistsError(f"File already exists: {p}")
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(args.get("content", ""), encoding="utf-8")
            result(req_id, {"content": [{"type": "text", "text": f"Created {p.name} ({p.stat().st_size} bytes) in {p}"}]})
            return

        if name == "edit_file":
            p = safe_path(args["path"])
            text = p.read_text(encoding="utf-8")
            old = args["old_string"]
            count = text.count(old)
            expected = args.get("expected_replacements")
            if count == 0:
                raise ValueError("old_string was not found")
            if expected is not None and count != expected:
                raise ValueError(f"Expected {expected} replacements, found {count}")
            text = text.replace(old, args["new_string"])
            p.write_text(text, encoding="utf-8")
            result(req_id, {"content": [{"type": "text", "text": f"Edited {p.name}: replaced {count} occurrence(s)."}]})
            return

        if name == "delete_file":
            p = safe_path(args["path"])
            if not p.exists():
                raise FileNotFoundError(str(p))
            if p.is_dir():
                if not args.get("recursive", False):
                    raise IsADirectoryError("Use recursive=true to delete a folder")
                shutil.rmtree(p)
            else:
                p.unlink()
            result(req_id, {"content": [{"type": "text", "text": f"Deleted {p}"}]})
            return

        if name == "move_file":
            src = safe_path(args["source"])
            dst = safe_path(args["destination"])
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            result(req_id, {"content": [{"type": "text", "text": f"Moved {src} -> {dst}"}]})
            return

        if name == "create_folder":
            p = safe_path(args["path"])
            p.mkdir(parents=True, exist_ok=True)
            result(req_id, {"content": [{"type": "text", "text": f"Created folder {p}"}]})
            return

        if name == "search_in_files":
            base = safe_path(args.get("path", "."))
            query = args["query"]
            regex = bool(args.get("regex", False))
            case_sensitive = bool(args.get("case_sensitive", False))
            limit = int(args.get("max_results", 100))
            import re
            pattern = re.compile(query, 0 if case_sensitive else re.IGNORECASE) if regex else None
            hits = []
            for fp in base.rglob("*") if base.is_dir() else [base]:
                if not fp.is_file():
                    continue
                try:
                    text = fp.read_text(encoding="utf-8")
                except Exception:
                    continue
                for i, line in enumerate(text.splitlines(), 1):
                    ok = bool(pattern.search(line)) if pattern else (query in line if case_sensitive else query.lower() in line.lower())
                    if ok:
                        hits.append(f"{fp}: {i}: {line}")
                        if len(hits) >= limit:
                            break
                if len(hits) >= limit:
                    break
            result(req_id, {"content": [{"type": "text", "text": "\n".join(hits) if hits else "No matches found."}]})
            return

        if name == "run_python":
            p = safe_path(args["path"])
            result(req_id, {"content": [{"type": "text", "text": run_process([sys.executable, str(p)], cwd=workspace_root, timeout=float(args.get("timeout", 120)))}]})
            return

        if name == "run_command":
            # Use the detached runner so a GUI app launch can never block the
            # whole MCP loop (see run_command_detached). The old timeout is
            # reused as the probe window: a command that finishes inside it
            # returns its real output, anything longer is treated as a
            # background process and control returns immediately.
            probe = float(args.get("timeout", 8))
            result(req_id, {"content": [{"type": "text", "text": run_command_detached(args["command"], cwd=workspace_root, probe_timeout=probe)}]})
            return

        if name == "run_detached":
            # Pure fire-and-forget: start the command and return at once, never
            # waiting even the probe window. For GUI launches where we do not
            # care about the output at all.
            try:
                subprocess.Popen(args["command"], cwd=str(workspace_root), shell=True,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                result(req_id, {"content": [{"type": "text", "text": "started (detached)"}]})
            except Exception as e:
                result(req_id, {"content": [{"type": "text", "text": f"failed to start: {e}"}]})
            return

        if name == "run_args":
            # Run a program + arg array directly (no shell), which avoids all
            # the cmd quoting problems a raw command string has on Windows.
            prog = args["program"]
            arr = list(args.get("args") or [])
            timeout = float(args.get("timeout", 120))
            result(req_id, {"content": [{"type": "text", "text": run_process([prog] + arr, cwd=workspace_root, timeout=timeout)}]})
            return

        if name == "screenshot":
            result(req_id, {"content": build_screenshot_content(
                window=args.get("window"), save=args.get("save"), ocr=bool(args.get("ocr", False)))})
            return

        if name == "format_code":
            p = safe_path(args["path"])
            ext = p.suffix.lower()
            if ext == ".py":
                result(req_id, {"content": [{"type": "text", "text": run_process([sys.executable, "-m", "black", str(p)], cwd=workspace_root)}]})
            elif ext in {".js", ".ts", ".json", ".css", ".html", ".md"}:
                result(req_id, {"content": [{"type": "text", "text": run_process(["npx", "prettier", "--write", str(p)], cwd=workspace_root)}]})
            else:
                raise ValueError(f"Unsupported format: {ext}")
            return

        if name == "run_tests":
            cmd = [sys.executable, "-m", "pytest"] + list(args.get("args", []))
            result(req_id, {"content": [{"type": "text", "text": run_process(cmd, cwd=workspace_root, timeout=float(args.get("timeout", 120)))}]})
            return

        if name == "git_status":
            result(req_id, {"content": [{"type": "text", "text": run_process(["git", "status", "--short", "--branch"], cwd=workspace_root)}]})
            return

        if name == "git_init":
            result(req_id, {"content": [{"type": "text", "text": run_process(["git", "init"], cwd=workspace_root)}]})
            return

        if name == "git_commit":
            files = args.get("files") or ["."]
            run_process(["git", "add", "--"] + files, cwd=workspace_root)
            result(req_id, {"content": [{"type": "text", "text": run_process(["git", "commit", "-m", args["message"]], cwd=workspace_root)}]})
            return

        if name == "npm_install":
            cmd = ["npm", "install"] + list(args.get("args", []))
            result(req_id, {"content": [{"type": "text", "text": run_process(cmd, cwd=workspace_root, timeout=float(args.get("timeout", 600)))}]})
            return

        if name == "install_packages":
            packages = list(args.get("packages", []))
            if not packages:
                raise ValueError("No packages specified")
            result(req_id, {"content": [{"type": "text", "text": run_process([sys.executable, "-m", "pip", "install"] + packages, cwd=workspace_root, timeout=600)}]})
            return

        if name == "find_program":
            q = str(args["name"]).strip()
            limit = int(args.get("max_results", 10))
            hits = find_programs(q, limit)
            if not hits:
                msg = (f"No program found matching '{q}'. "
                       "Try list_programs with a shorter filter, or give the full path.")
            else:
                msg = "\n".join(hits)
            result(req_id, {"content": [{"type": "text", "text": msg}]})
            return

        if name == "list_programs":
            flt = str(args.get("filter", "")).strip().lower()
            limit = int(args.get("max_results", 100))
            hits = scan_programs(flt, limit)
            if not hits:
                msg = "No launchable programs found."
            else:
                msg = f"{len(hits)} program(s) found" + (f" matching '{flt}'" if flt else "") + ":\n" + "\n".join(hits)
            result(req_id, {"content": [{"type": "text", "text": msg}]})
            return

        raise ValueError(f"Unknown tool: {name}")

    except Exception as exc:
        error(req_id, -32000, str(exc))


while True:
    request = read_message()
    if request is None:
        break
    handle(request)