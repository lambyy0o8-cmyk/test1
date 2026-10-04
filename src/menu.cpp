#include "menu.h"
#include "settings.h"
#include <cstdio>

using namespace Gdiplus;

static const Color C_BG        (240, 18, 18, 22);
static const Color C_HEADER    (255, 24, 24, 30);
static const Color C_BORDER    (255, 45, 45, 55);
static const Color C_ACCENT    (255, 0, 170, 255);
static const Color C_TEXT      (255, 225, 225, 235);
static const Color C_TEXT_DIM  (255, 130, 130, 145);
static const Color C_ROW       (255, 30, 30, 38);
static const Color C_ROW_HOVER (255, 38, 38, 48);
static const Color C_TRACK     (255, 45, 45, 55);

static const int W = 300, H = 400;
static const int HEADER_H = 34;
static const int PAD = 14;
static const int ROW_H = 30;
static const int GAP = 6;

static int RowY(int index) { return HEADER_H + PAD + index * (ROW_H + GAP); }

Menu::Menu() {
    GdiplusStartupInput in;
    GdiplusStartup(&gdiToken_, &in, nullptr);
    font_      = new Font(L"Segoe UI", 11.0f, FontStyleRegular, UnitPixel);
    fontBold_  = new Font(L"Segoe UI", 11.0f, FontStyleBold, UnitPixel);
    fontTitle_ = new Font(L"Segoe UI", 13.0f, FontStyleBold, UnitPixel);
}

Menu::~Menu() {
    delete font_; delete fontBold_; delete fontTitle_;
    if (gdiToken_) GdiplusShutdown(gdiToken_);
}

void Menu::Update(HDC target, int screenW, int screenH) {
    screenW_ = screenW;
    screenH_ = screenH;

    bool insertDown = (GetAsyncKeyState(VK_INSERT) & 0x8000) != 0;
    if (insertDown && !prevInsert_) visible_ = !visible_;
    prevInsert_ = insertDown;

    if (visible_) HandleInput();

    if (visible_ && target) {
        Graphics g(target);
        g.SetSmoothingMode(SmoothingModeAntiAlias);
        g.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);
        Draw(g);
    }
}

void Menu::HandleInput() {
    POINT p; GetCursorPos(&p);
    bool mouseDown = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;

    // Window-relative coords
    int lx = p.x - posX_;
    int ly = p.y - posY_;

    if (mouseDown && !prevMouse_) {
        // Header drag
        if (lx >= 0 && lx <= W && ly >= 0 && ly <= HEADER_H) {
            dragging_ = true;
            dragOffX_ = lx;
            dragOffY_ = ly;
        } else if (lx >= 0 && lx <= W && ly >= 0 && ly <= H) {
            int rowW = W - PAD * 2;
            int baseY = RowY(0);
            int relY = ly - baseY;
            if (relY >= 0) {
                int idx = relY / (ROW_H + GAP);
                int inRow = relY % (ROW_H + GAP);
                if (inRow <= ROW_H) {
                    switch (idx) {
                    case 0: g_settings.espEnabled  = !g_settings.espEnabled;  break;
                    case 1: g_settings.drawBoxes   = !g_settings.drawBoxes;   break;
                    case 2: g_settings.drawHealth  = !g_settings.drawHealth;  break;
                    case 3: g_settings.drawNames   = !g_settings.drawNames;   break;
                    case 4: g_settings.drawDistance= !g_settings.drawDistance;break;
                    case 5:
                        if (lx >= PAD && lx <= PAD + 30) { int v=g_settings.lineWidth.load(); if(v>1) g_settings.lineWidth=v-1; }
                        else if (lx >= W - PAD - 30 && lx <= W - PAD) { int v=g_settings.lineWidth.load(); if(v<6) g_settings.lineWidth=v+1; }
                        break;
                    case 6:
                        if (lx >= PAD && lx <= PAD + 30) { float v=g_settings.maxDistance.load(); if(v>100) g_settings.maxDistance=v-100; }
                        else if (lx >= W - PAD - 30 && lx <= W - PAD) { float v=g_settings.maxDistance.load(); if(v<5000) g_settings.maxDistance=v+100; }
                        break;
                    }
                }
            }
        }
    }

    if (mouseDown && dragging_) {
        posX_ = p.x - dragOffX_;
        posY_ = p.y - dragOffY_;
        if (posX_ < 0) posX_ = 0;
        if (posY_ < 0) posY_ = 0;
        if (posX_ + W > screenW_) posX_ = screenW_ - W;
        if (posY_ + H > screenH_) posY_ = screenH_ - H;
    }
    if (!mouseDown) dragging_ = false;
    prevMouse_ = mouseDown;
}

static void FillRound(Graphics& g, Rect r, int radius, Color c) {
    GraphicsPath path;
    int d = radius * 2;
    path.AddArc(r.X, r.Y, d, d, 180, 90);
    path.AddArc(r.X + r.Width - d, r.Y, d, d, 270, 90);
    path.AddArc(r.X + r.Width - d, r.Y + r.Height - d, d, d, 0, 90);
    path.AddArc(r.X, r.Y + r.Height - d, d, d, 90, 90);
    path.CloseFigure();
    SolidBrush b(c);
    g.FillPath(&b, &path);
}

static void DrawTextR(Graphics& g, const wchar_t* txt, Font* f, RectF r, Color c, int align) {
    StringFormat sf;
    sf.SetAlignment((StringAlignment)align);
    sf.SetLineAlignment(StringAlignmentCenter);
    SolidBrush b(c);
    g.DrawString(txt, -1, f, r, &sf, &b);
}

void Menu::Draw(Graphics& g) {
    FillRound(g, Rect(posX_, posY_, W, H), 10, C_BG);

    GraphicsPath hdr;
    int d = 20;
    hdr.AddArc(posX_, posY_, d, d, 180, 90);
    hdr.AddArc(posX_ + W - d, posY_, d, d, 270, 90);
    hdr.AddLine(posX_ + W, posY_ + HEADER_H, posX_, posY_ + HEADER_H);
    hdr.CloseFigure();
    SolidBrush hb(C_HEADER);
    g.FillPath(&hb, &hdr);

    SolidBrush ab(C_ACCENT);
    g.FillRectangle(&ab, posX_ + 1, posY_ + HEADER_H - 2, W - 2, 2);

    Pen bp(C_BORDER, 1.0f);
    GraphicsPath border;
    int dd = 20;
    border.AddArc(posX_, posY_, dd, dd, 180, 90);
    border.AddArc(posX_ + W - dd, posY_, dd, dd, 270, 90);
    border.AddArc(posX_ + W - dd, posY_ + H - dd, dd, dd, 0, 90);
    border.AddArc(posX_, posY_ + H - dd, dd, dd, 90, 90);
    border.CloseFigure();
    g.DrawPath(&bp, &border);

    DrawTextR(g, L"LamByy Hack", fontTitle_,
        RectF((REAL)(posX_ + PAD), (REAL)(posY_ + 4), 180.0f, (REAL)(HEADER_H - 6)), C_TEXT, 0);
    DrawTextR(g, L"CS2 v7.3", font_,
        RectF((REAL)(posX_ + W - 100), (REAL)(posY_ + 4), 86.0f, (REAL)(HEADER_H - 6)), C_TEXT_DIM, 2);

    struct Row { const wchar_t* label; bool value; };
    Row toggles[] = {
        { L"ESP Enabled", g_settings.espEnabled.load() },
        { L"Boxes",       g_settings.drawBoxes.load() },
        { L"Health",      g_settings.drawHealth.load() },
        { L"Names",       g_settings.drawNames.load() },
        { L"Distance",    g_settings.drawDistance.load() },
    };

    int baseX = posX_ + PAD;
    int rowW = W - PAD * 2;

    for (int i = 0; i < 5; ++i) {
        int ry = posY_ + RowY(i);
        FillRound(g, Rect(baseX, ry, rowW, ROW_H), 6, C_ROW);
        DrawTextR(g, toggles[i].label, font_,
            RectF((REAL)(baseX + 12), (REAL)ry, (REAL)(rowW - 80), (REAL)ROW_H), C_TEXT, 0);

        int swX = posX_ + W - PAD - 46;
        int swY = ry + 6;
        int swW = 46, swH = 18;
        Color track = toggles[i].value ? C_ACCENT : C_TRACK;
        FillRound(g, Rect(swX, swY, swW, swH), swH / 2, track);
        int knobX = toggles[i].value ? swX + swW - swH : swX;
        SolidBrush kb(Color(255, 240, 240, 245));
        g.FillEllipse(&kb, knobX, swY, swH, swH);
    }

    wchar_t wbuf[32], dbuf[32];
    swprintf(wbuf, 32, L"%d", g_settings.lineWidth.load());
    swprintf(dbuf, 32, L"%.0f", g_settings.maxDistance.load());

    for (int i = 5; i < 7; ++i) {
        int ry = posY_ + RowY(i);
        const wchar_t* label = (i == 5) ? L"Thickness" : L"Max distance";
        const wchar_t* val = (i == 5) ? wbuf : dbuf;
        FillRound(g, Rect(baseX, ry, rowW, ROW_H), 6, C_ROW);
        DrawTextR(g, label, font_,
            RectF((REAL)(baseX + 12), (REAL)ry, 130.0f, (REAL)ROW_H), C_TEXT, 0);

        FillRound(g, Rect(baseX + rowW - 90, ry + 5, 24, 20), 5, C_ROW_HOVER);
        DrawTextR(g, L"-", fontBold_, RectF((REAL)(baseX + rowW - 90), (REAL)(ry + 5), 24.0f, 20.0f), C_TEXT, 1);
        DrawTextR(g, val, fontBold_,
            RectF((REAL)(baseX + rowW - 62), (REAL)ry, 34.0f, (REAL)ROW_H), C_ACCENT, 1);
        FillRound(g, Rect(baseX + rowW - 24, ry + 5, 24, 20), 5, C_ROW_HOVER);
        DrawTextR(g, L"+", fontBold_, RectF((REAL)(baseX + rowW - 24), (REAL)(ry + 5), 24.0f, 20.0f), C_TEXT, 1);
    }
}
