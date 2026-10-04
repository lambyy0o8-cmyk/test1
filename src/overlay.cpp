#include "overlay.h"

static const wchar_t* kClass = L"LamByyOverlayWnd";

LRESULT CALLBACK Overlay::WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    case WM_ERASEBKGND:
        return 1;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

bool Overlay::Init(HINSTANCE hInst) {
    Gdiplus::GdiplusStartupInput in;
    Gdiplus::GdiplusStartup(&gdiToken_, &in, nullptr);

    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInst;
    wc.hbrBackground = nullptr;
    wc.lpszClassName = kClass;
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    RegisterClassExW(&wc);

    w_ = GetSystemMetrics(SM_CXSCREEN);
    h_ = GetSystemMetrics(SM_CYSCREEN);

    hwnd_ = CreateWindowExW(
        WS_EX_TOPMOST | WS_EX_TRANSPARENT | WS_EX_LAYERED | WS_EX_TOOLWINDOW,
        kClass, L"LamByyOverlay",
        WS_POPUP,
        0, 0, w_, h_,
        nullptr, nullptr, hInst, nullptr);
    if (!hwnd_) return false;

    // 32-bit DIB with alpha for UpdateLayeredWindow
    HDC screen = GetDC(nullptr);
    memDC_ = CreateCompatibleDC(screen);
    ReleaseDC(nullptr, screen);

    BITMAPINFO bi{};
    bi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bi.bmiHeader.biWidth = w_;
    bi.bmiHeader.biHeight = -h_;   // top-down
    bi.bmiHeader.biPlanes = 1;
    bi.bmiHeader.biBitCount = 32;
    bi.bmiHeader.biCompression = BI_RGB;
    bmp_ = CreateDIBSection(memDC_, &bi, DIB_RGB_COLORS, &bits_, nullptr, 0);
    if (!bmp_) { DestroyWindow(hwnd_); hwnd_ = nullptr; return false; }
    oldBmp_ = (HBITMAP)SelectObject(memDC_, bmp_);

    ShowWindow(hwnd_, SW_SHOW);
    return true;
}

void Overlay::Shutdown() {
    if (memDC_) {
        SelectObject(memDC_, oldBmp_);
        DeleteObject(bmp_);
        DeleteDC(memDC_);
        memDC_ = nullptr;
    }
    if (hwnd_) { DestroyWindow(hwnd_); hwnd_ = nullptr; }
    if (gdiToken_) { Gdiplus::GdiplusShutdown(gdiToken_); gdiToken_ = 0; }
}

bool Overlay::Pump() {
    MSG msg;
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
        if (msg.message == WM_QUIT) return false;
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    return IsWindow(hwnd_) != 0;
}

HDC Overlay::BeginDraw() {
    // zero everything (fully transparent)
    memset(bits_, 0, (size_t)w_ * h_ * 4);
    return memDC_;
}

void Overlay::EndDraw() {
    HDC screen = GetDC(nullptr);
    POINT ptSrc{ 0, 0 };
    POINT ptDst{ 0, 0 };
    SIZE size{ w_, h_ };
    BLENDFUNCTION blend{};
    blend.BlendOp = AC_SRC_OVER;
    blend.SourceConstantAlpha = 255;
    blend.AlphaFormat = AC_SRC_ALPHA;
    UpdateLayeredWindow(hwnd_, screen, &ptDst, &size, memDC_, &ptSrc, 0, &blend, ULW_ALPHA);
    ReleaseDC(nullptr, screen);
}
