#pragma once
#include <Windows.h>
#include <gdiplus.h>
#include <atomic>

class Menu {
public:
    Menu();
    ~Menu();
    void Update(HDC target, int screenW, int screenH);
    bool Visible() const { return visible_; }

private:
    void Draw(Gdiplus::Graphics& g);
    void HandleInput();

    bool visible_ = false;
    bool prevInsert_ = false;
    bool prevMouse_ = false;

    int screenW_ = 0, screenH_ = 0;
    int posX_ = 60, posY_ = 60;
    int dragOffX_ = 0, dragOffY_ = 0;
    bool dragging_ = false;

    ULONG_PTR gdiToken_ = 0;
    Gdiplus::Font* font_ = nullptr;
    Gdiplus::Font* fontBold_ = nullptr;
    Gdiplus::Font* fontTitle_ = nullptr;
};
