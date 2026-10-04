#pragma once
#include <Windows.h>
#include <gdiplus.h>
#include <atomic>

class Overlay {
public:
    bool Init(HINSTANCE hInst);
    void Shutdown();
    bool Pump();                 // process messages; returns false if window closed
    HWND Hwnd() const { return hwnd_; }

    // call from render loop: returns HDC of the overlay backbuffer
    HDC BeginDraw();
    void EndDraw();

    int Width() const { return w_; }
    int Height() const { return h_; }

private:
    static LRESULT CALLBACK WndProc(HWND, UINT, WPARAM, LPARAM);
    HWND hwnd_ = nullptr;
    HDC memDC_ = nullptr;
    HBITMAP bmp_ = nullptr;
    HBITMAP oldBmp_ = nullptr;
    void* bits_ = nullptr;
    int w_ = 0, h_ = 0;
    ULONG_PTR gdiToken_ = 0;
};
