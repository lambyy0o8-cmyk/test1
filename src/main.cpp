#include "memory.h"
#include "esp.h"
#include "menu.h"
#include "overlay.h"
#include "settings.h"
#include <Windows.h>
#include <thread>
#include <chrono>
#include <cstdio>

Settings g_settings;

void DebugDumpOffsets(const Memory& mem);

static bool g_running = true;

BOOL WINAPI ConsoleHandler(DWORD signal) {
    if (signal == CTRL_C_EVENT || signal == CTRL_CLOSE_EVENT) {
        g_running = false;
        return TRUE;
    }
    return FALSE;
}

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE, LPSTR, int) {
    AllocConsole();
    freopen("CONOUT$", "w", stdout);
    SetConsoleCtrlHandler(ConsoleHandler, TRUE);
    printf("[+] LamByy Hack CS2 External v7.3\n");
    printf("[+] Insert = menu, ESP on by default\n");

    Overlay overlay;
    if (!overlay.Init(hInst)) {
        printf("[-] Overlay init failed\n");
        return 1;
    }

    Memory mem;
    Esp esp(mem);
    Menu menu;

    while (g_running && overlay.Pump()) {
        if (!mem.IsAttached()) {
            if (mem.Attach(L"cs2.exe")) {
                printf("[+] Attached to cs2.exe (pid %lu, base 0x%llX)\n",
                       mem.Pid(), (unsigned long long)mem.Base());
                DebugDumpOffsets(mem);
            }
        }

        HDC dc = overlay.BeginDraw();
        esp.Run(dc);
        menu.Update(dc, overlay.Width(), overlay.Height());
        overlay.EndDraw();

        std::this_thread::sleep_for(std::chrono::milliseconds(2));
    }

    mem.Detach();
    overlay.Shutdown();
    printf("[+] Exited.\n");
    return 0;
}
