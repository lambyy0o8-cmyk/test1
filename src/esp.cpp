#include "esp.h"
#include "offsets.h"
#include "settings.h"
#include <Windows.h>
#include <cstdio>
#include <cstring>
#include <cmath>
#include <vector>

static float Distance3D(const Vec3& a, const Vec3& b) {
    float dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return sqrtf(dx*dx + dy*dy + dz*dz);
}

void Esp::Run(HDC target) {
    if (!mem_.IsAttached()) return;
    if (!g_settings.espEnabled.load()) return;
    if (!target) return;

    screenW_ = GetSystemMetrics(SM_CXSCREEN);
    screenH_ = GetSystemMetrics(SM_CYSCREEN);

    uintptr_t viewMatrixAddr = mem_.Base() + offsets::dwViewMatrix;
    if (!mem_.ReadBuffer(viewMatrixAddr, viewMatrix_, sizeof(viewMatrix_))) return;

    BuildEntities();
    DrawOverlay(target);
}

void Esp::BuildEntities() {
    entities_.clear();

    auto localPawn = mem_.Read<uintptr_t>(mem_.Base() + offsets::dwLocalPlayerPawn);
    if (!localPawn || !*localPawn) return;
    auto localTeam = mem_.Read<int>(*localPawn + offsets::m_iTeamNum);

    auto entityList = mem_.Read<uintptr_t>(mem_.Base() + offsets::dwEntityList);
    if (!entityList) return;

    float maxDist = g_settings.maxDistance.load();

    for (int i = 1; i <= 64; ++i) {
        auto listEntry = mem_.Read<uintptr_t>(*entityList + 8 * (i >> 9) + 16);
        if (!listEntry) continue;
        auto controller = mem_.Read<uintptr_t>(*listEntry + 120 * (i & 0x1FF));
        if (!controller || !*controller) continue;

        auto pawnHandle = mem_.Read<uint32_t>(*controller + offsets::m_hPlayerPawn);
        if (!pawnHandle) continue;

        auto pawnEntry = mem_.Read<uintptr_t>(*entityList + 8 * ((*pawnHandle & 0x7FFF) >> 9) + 16);
        if (!pawnEntry) continue;
        auto pawn = mem_.Read<uintptr_t>(*pawnEntry + 120 * (*pawnHandle & 0x1FF));
        if (!pawn || !*pawn) continue;

        auto health = mem_.Read<int>(*pawn + offsets::m_iHealth);
        auto team = mem_.Read<int>(*pawn + offsets::m_iTeamNum);
        auto lifeState = mem_.Read<uint8_t>(*pawn + offsets::m_lifeState);
        if (!health || !team || !lifeState) continue;
        if (*health <= 0 || *health > 100 || *lifeState != 0) continue;
        if (localTeam && *team == *localTeam) continue;

        auto sceneNode = mem_.Read<uintptr_t>(*pawn + offsets::m_pGameSceneNode);
        if (!sceneNode) continue;
        auto origin = mem_.Read<Vec3>(*sceneNode + offsets::m_vecAbsOrigin);
        if (!origin) continue;

        Entity ent;
        ent.pawn = *pawn;
        ent.controller = *controller;
        ent.health = *health;
        ent.team = *team;
        ent.origin = *origin;
        if (!mem_.ReadBuffer(*controller + offsets::m_iszPlayerName, ent.name, sizeof(ent.name) - 1)) {
            strncpy_s(ent.name, "?игрок", _TRUNCATE);
        }
        ent.name[sizeof(ent.name) - 1] = '\0';
        ent.valid = true;
        entities_.push_back(ent);
    }
}

bool Esp::WorldToScreen(const Vec3& world, Vec2& out, const float m[4][4], int w, int h) const {
    float clipX = world.x * m[0][0] + world.y * m[0][1] + world.z * m[0][2] + m[0][3];
    float clipY = world.x * m[1][0] + world.y * m[1][1] + world.z * m[1][2] + m[1][3];
    float clipW = world.x * m[3][0] + world.y * m[3][1] + world.z * m[3][2] + m[3][3];
    if (clipW < 0.01f) return false;

    float ndcX = clipX / clipW;
    float ndcY = clipY / clipW;
    out.x = (w * 0.5f) * (1.0f + ndcX);
    out.y = (h * 0.5f) * (1.0f - ndcY);
    return true;
}

void Esp::DrawOverlay(HDC hdc) const {
    if (!hdc) return;

    int lw = g_settings.lineWidth.load();
    bool drawBoxes = g_settings.drawBoxes.load();
    bool drawHealth = g_settings.drawHealth.load();
    bool drawNames = g_settings.drawNames.load();
    bool drawDist = g_settings.drawDistance.load();

    // Need a local player pos for distance calc
    Vec3 localOrigin{};
    bool hasLocal = false;
    if (auto lp = mem_.Read<uintptr_t>(mem_.Base() + offsets::dwLocalPlayerPawn)) {
        if (*lp) {
            if (auto sn = mem_.Read<uintptr_t>(*lp + offsets::m_pGameSceneNode)) {
                if (auto org = mem_.Read<Vec3>(*sn + offsets::m_vecAbsOrigin)) {
                    localOrigin = *org;
                    hasLocal = true;
                }
            }
        }
    }

    for (const auto& ent : entities_) {
        Vec2 head, feet;
        Vec3 headPos = { ent.origin.x, ent.origin.y, ent.origin.z + 72.0f };
        if (!WorldToScreen(headPos, head, viewMatrix_, screenW_, screenH_)) continue;
        if (!WorldToScreen(ent.origin, feet, viewMatrix_, screenW_, screenH_)) continue;

        int height = static_cast<int>(feet.y - head.y);
        int width = height / 2;
        if (height < 4) continue;

        int hx = static_cast<int>(head.x - width / 2);
        int hy = static_cast<int>(head.y);
        int fw = width;
        int fh = height;

        if (drawBoxes) {
            HPEN pen = CreatePen(PS_SOLID, lw, RGB(0, 255, 0));
            HGDIOBJ oldPen = SelectObject(hdc, pen);
            HGDIOBJ oldBrush = SelectObject(hdc, GetStockObject(HOLLOW_BRUSH));
            Rectangle(hdc, hx, hy, hx + fw, hy + fh);
            SelectObject(hdc, oldBrush);
            SelectObject(hdc, oldPen);
            DeleteObject(pen);
        }

        SetBkMode(hdc, TRANSPARENT);
        int textY = hy;

        if (drawHealth) {
            char hp[32];
            snprintf(hp, sizeof(hp), "%d HP", ent.health);
            SetTextColor(hdc, RGB(0, 255, 0));
            TextOutA(hdc, hx + fw + 4, textY, hp, (int)strlen(hp));
            textY += 16;
        }

        if (drawNames) {
            SetTextColor(hdc, RGB(255, 215, 0));
            TextOutA(hdc, hx, hy - 18, ent.name, (int)strlen(ent.name));
        }

        if (drawDist && hasLocal) {
            char db[32];
            snprintf(db, sizeof(db), "%.0fm", Distance3D(localOrigin, ent.origin) * 0.01905f);
            SetTextColor(hdc, RGB(200, 200, 255));
            TextOutA(hdc, hx + fw + 4, textY, db, (int)strlen(db));
        }
    }
}
