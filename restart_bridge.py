#!/usr/bin/env python3
# restart_bridge.py - safely restart the ZeroScript bridge from OUTSIDE it.
#
# Why this exists: the bridge hosts the MCP servers (including this file's
# caller). A process cannot restart itself without dying mid-restart, so the
# restart must run DETACHED - this script is launched as a separate, fully
# independent process that survives the bridge being killed.
#
# Usage:
#   py -3 restart_bridge.py            # restart the bridge
#   py -3 restart_bridge.py --delay 3  # wait 3s before killing (default 2)
#
# It: (1) finds any python process running bridge.py, (2) kills it, (3) waits a
# moment for the port to free, (4) relaunches start.bat detached so the new
# bridge keeps running after this script exits.
import argparse
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
START_BAT = os.path.join(HERE, "start.bat")
BRIDGE = os.path.join(HERE, "bridge.py")


def log(msg):
    print(f"[restart_bridge] {msg}", flush=True)


def find_bridge_pids():
    """PIDs of python processes whose command line runs bridge.py (never our own)."""
    me = os.getpid()
    pids = []
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-CimInstance Win32_Process | "
             "Where-Object { $_.CommandLine -like '*bridge.py*' } | "
             "ForEach-Object { \"$($_.ProcessId) $($_.Name)\" }"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=20,
        ).stdout
    except Exception as e:
        log(f"could not enumerate processes: {e}")
        return []
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0].isdigit():
            pid = int(parts[0])
            name = parts[1].lower()
            if pid != me and "python" in name:
                pids.append(pid)
    return pids


def kill_pids(pids):
    for pid in pids:
        try:
            subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                           capture_output=True, text=True, timeout=10)
            log(f"killed bridge pid {pid}")
        except Exception as e:
            log(f"could not kill pid {pid}: {e}")


def launch_bridge():
    if not os.path.exists(START_BAT):
        log(f"ERROR: start.bat not found at {START_BAT}")
        return False
    # DETACHED_PROCESS (0x8) | CREATE_NEW_PROCESS_GROUP (0x200): the new bridge
    # keeps running after this script (and its console) exits.
    flags = 0x00000008 | 0x00000200
    try:
        subprocess.Popen(
            ["cmd", "/c", START_BAT],
            cwd=HERE,
            creationflags=flags,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        log("relaunched start.bat (detached)")
        return True
    except Exception as e:
        log(f"could not relaunch start.bat: {e}")
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--delay", type=float, default=2.0)
    ap.add_argument("--spawn", action="store_true",
                    help="Re-launch this script DETACHED and exit immediately, so the "
                         "caller (which runs synchronously) gets its reply before the "
                         "bridge is killed. Use this when invoked from an MCP command.")
    args = ap.parse_args()

    # Single-instance guard: only ONE restarter may run at a time. Without this,
    # two near-simultaneous invocations each spawn a detached killer, the second
    # killing the fresh bridge the first just launched (an endless restart loop).
    lock_path = os.path.join(HERE, ".restart_bridge.lock")
    try:
        if os.path.exists(lock_path):
            age = time.time() - os.path.getmtime(lock_path)
            if age < 30:
                log(f"another restart is already in progress ({age:.0f}s ago) - skipping.")
                return 0
    except Exception:
        pass
    try:
        with open(lock_path, "w") as f:
            f.write(str(os.getpid()))
    except Exception:
        pass

    if args.spawn:
        flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(
            [sys.executable, os.path.abspath(__file__), "--delay", str(args.delay)],
            cwd=HERE, creationflags=flags,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        log("spawned detached restarter - this process exits now, the bridge will restart shortly.")
        return 0

    log("looking for a running bridge...")
    pids = find_bridge_pids()
    if not pids:
        log("no running bridge.py found - just starting a fresh one.")
        launch_bridge()
        return 0

    log(f"found bridge pid(s): {pids}")
    log(f"waiting {args.delay}s so the caller's reply can flush...")
    time.sleep(args.delay)
    kill_pids(pids)
    time.sleep(1.5)  # let Windows release the listen port
    ok = launch_bridge()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
