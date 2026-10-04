#include "memory.h"
#include <TlHelp32.h>
#include <vector>

bool Memory::Attach(const std::wstring& processName) {
    Detach();
    processName_ = processName;

    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == INVALID_HANDLE_VALUE) return false;

    PROCESSENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    if (Process32FirstW(snapshot, &entry)) {
        do {
            if (processName == entry.szExeFile) {
                pid_ = entry.th32ProcessID;
                break;
            }
        } while (Process32NextW(snapshot, &entry));
    }
    CloseHandle(snapshot);
    if (pid_ == 0) return false;

    handle_ = OpenProcess(PROCESS_VM_READ | PROCESS_VM_WRITE | PROCESS_VM_OPERATION | PROCESS_QUERY_INFORMATION, FALSE, pid_);
    if (!handle_) { pid_ = 0; return false; }

    auto moduleBase = GetModuleBase(L"client.dll");
    if (!moduleBase) moduleBase = GetModuleBase(processName);
    if (!moduleBase) { Detach(); return false; }
    base_ = *moduleBase;
    return true;
}

void Memory::Detach() {
    if (handle_) { CloseHandle(handle_); handle_ = nullptr; }
    pid_ = 0;
    base_ = 0;
}

std::optional<uintptr_t> Memory::GetModuleBase(const std::wstring& moduleName) const {
    if (!pid_) return std::nullopt;
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid_);
    if (snapshot == INVALID_HANDLE_VALUE) return std::nullopt;

    MODULEENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    std::optional<uintptr_t> result;
    if (Module32FirstW(snapshot, &entry)) {
        do {
            if (moduleName == entry.szModule) {
                result = reinterpret_cast<uintptr_t>(entry.modBaseAddr);
                break;
            }
        } while (Module32NextW(snapshot, &entry));
    }
    CloseHandle(snapshot);
    return result;
}
