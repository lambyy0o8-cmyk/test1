# _grab.py - screenshot helper for vscode_mcp_server's `screenshot` tool.
# Runs under Python 3.11 (pyautogui + pytesseract live there).
#
# Usage:
#   python _grab.py --out shot.png [--window "substring"] [--ocr]
#
# --window  capture just that window (matched by case-insensitive title
#           substring), raising it first so the capture is not of whatever
#           window happens to be on top.
# --ocr     also print every recognised word as:  text|x|y

import argparse
import sys

TESS = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--window", default=None)
    ap.add_argument("--ocr", action="store_true")
    a = ap.parse_args()

    try:
        import pyautogui
    except Exception as e:
        print(f"IMPORT_FAILED: {e}")
        return 1

    region = None
    if a.window:
        try:
            import pygetwindow as gw
            titles = [t for t in gw.getAllTitles() if a.window.lower() in t.lower()]
            if not titles:
                print(f"WINDOW_NOT_FOUND: {a.window}")
                return 1
            win = gw.getWindowsWithTitle(titles[0])[0]
            try:
                if win.isMinimized:
                    win.restore()
            except Exception:
                pass
            try:
                import win32gui, win32con
                hwnd = win32gui.FindWindow(None, titles[0])
                if hwnd:
                    if win32gui.IsIconic(hwnd):
                        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                    win32gui.SetForegroundWindow(hwnd)
            except Exception:
                pass
            import time
            time.sleep(0.6)
            region = (win.left, win.top, win.width, win.height)
        except Exception as e:
            print(f"WINDOW_LOOKUP_FAILED: {e}")

    img = pyautogui.screenshot(region=region)
    img.save(a.out)
    print(f"SAVED: {a.out}")
    if region:
        print(f"RECT: {region[0]},{region[1]},{region[2]},{region[3]}")

    if a.ocr:
        try:
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = TESS
            data = pytesseract.image_to_data(img, lang="eng", output_type=pytesseract.Output.DICT)
            base_x = region[0] if region else 0
            base_y = region[1] if region else 0
            print("--- OCR (text|x|y) ---")
            for i in range(len(data["text"])):
                t = (data["text"][i] or "").strip()
                if not t:
                    continue
                try:
                    conf = int(float(data["conf"][i]))
                except Exception:
                    conf = -1
                if conf < 40:
                    continue
                x = base_x + data["left"][i] + data["width"][i] // 2
                y = base_y + data["top"][i] + data["height"][i] // 2
                print(f"{t}|{x}|{y}")
        except Exception as e:
            print(f"OCR_FAILED: {e}")
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(main())
