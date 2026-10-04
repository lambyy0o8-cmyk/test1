#pragma once
#include <Windows.h>
#include <cstdint>
#include <string>
#include <optional>

class Memory {
public:
    bool Attach(const std::wstring& processName);
    void Detach();

    bool IsAttached() const { return handle_ != nullptr && pid_ != 0; }
    DWORD Pid() const { return pid_; }
    uintptr_t Base() const { return base_; }

    template <typename T>
    std::optional<T> Read(uintptr_t address) const {
        T buffer{};
        SIZE_T read = 0;
        if (!ReadProcessMemory(handle_, reinterpret_cast<LPCVOID>(address), &buffer, sizeof(T), &read) || read != sizeof(T)) {
            return std::nullopt;
        }
        return buffer;
    }

    template <typename T>
    bool Write(uintptr_t address, const T& value) const {
        SIZE_T written = 0;
        return WriteProcessMemory(handle_, reinterpret_cast<LPVOID>(address), &value, sizeof(T), &written) && written == sizeof(T);
    }

    bool ReadBuffer(uintptr_t address, void* out, size_t size) const {
        SIZE_T read = 0;
        return ReadProcessMemory(handle_, reinterpret_cast<LPCVOID>(address), out, size, &read) && read == size;
    }

    std::optional<uintptr_t> GetModuleBase(const std::wstring& moduleName) const;

private:
    HANDLE handle_ = nullptr;
    DWORD pid_ = 0;
    uintptr_t base_ = 0;
    std::wstring processName_;
};
