#pragma once
#include <Windows.h>
#include <atomic>

struct Settings {
    std::atomic<bool> espEnabled{ true };
    std::atomic<bool> drawBoxes{ true };
    std::atomic<bool> drawHealth{ true };
    std::atomic<bool> drawNames{ false };
    std::atomic<bool> drawDistance{ false };
    std::atomic<int>  lineWidth{ 2 };
    std::atomic<float> maxDistance{ 500.0f };
};

extern Settings g_settings;
