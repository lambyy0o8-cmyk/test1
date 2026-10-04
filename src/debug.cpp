#include "memory.h"
#include "offsets.h"
#include <cstdio>

void DebugDumpOffsets(const Memory& mem) {
    FILE* f = fopen("cs2_debug.log", "w");
    if (!f) return;
    auto w = [&](const char* s) { fputs(s, f); fflush(f); };

    if (!mem.IsAttached()) { w("not attached\n"); fclose(f); return; }

    char buf[256];
    uintptr_t base = mem.Base();
    snprintf(buf, sizeof(buf), "base = 0x%llX\n", (unsigned long long)base); w(buf);

    auto vm = mem.Read<float>(base + offsets::dwViewMatrix);
    snprintf(buf, sizeof(buf), "viewMatrix[0][0] = %f %s\n", vm ? *vm : 0.0f, vm ? "" : "(READ FAIL)"); w(buf);

    auto el = mem.Read<uintptr_t>(base + offsets::dwEntityList);
    snprintf(buf, sizeof(buf), "entityList = 0x%llX %s\n", el ? (unsigned long long)*el : 0ULL, el ? "" : "(READ FAIL)"); w(buf);

    auto lp = mem.Read<uintptr_t>(base + offsets::dwLocalPlayerPawn);
    snprintf(buf, sizeof(buf), "localPawn = 0x%llX %s\n", lp ? (unsigned long long)*lp : 0ULL, lp ? "" : "(READ FAIL)"); w(buf);

    if (lp && *lp) {
        auto hp = mem.Read<int>(*lp + offsets::m_iHealth);
        auto team = mem.Read<int>(*lp + offsets::m_iTeamNum);
        snprintf(buf, sizeof(buf), "local hp=%d team=%d\n", hp ? *hp : -1, team ? *team : -1); w(buf);

        auto sn = mem.Read<uintptr_t>(*lp + offsets::m_pGameSceneNode);
        snprintf(buf, sizeof(buf), "local sceneNode = 0x%llX\n", sn ? (unsigned long long)*sn : 0ULL); w(buf);
        if (sn && *sn) {
            auto org = mem.Read<float>(*sn + offsets::m_vecAbsOrigin);
            snprintf(buf, sizeof(buf), "local origin.x = %f\n", org ? *org : 0.0f); w(buf);
        }
    }

    // count entities scanned + dump first enemy
    if (el && *el) {
        int found = 0;
        int dumped = 0;
        auto localTeam = 0;
        if (lp && *lp) { auto lt = mem.Read<int>(*lp + offsets::m_iTeamNum); if (lt) localTeam = *lt; }
        for (int i = 1; i <= 64; ++i) {
            auto le = mem.Read<uintptr_t>(*el + 8 * (i >> 9) + 16);
            if (!le) continue;
            auto ctrl = mem.Read<uintptr_t>(*le + 120 * (i & 0x1FF));
            if (!ctrl || !*ctrl) continue;
            found++;
            if (dumped >= 3) continue;
            auto ph = mem.Read<uint32_t>(*ctrl + offsets::m_hPlayerPawn);
            if (!ph) continue;
            auto pe = mem.Read<uintptr_t>(*el + 8 * ((*ph & 0x7FFF) >> 9) + 16);
            if (!pe) continue;
            auto pawn = mem.Read<uintptr_t>(*pe + 120 * (*ph & 0x1FF));
            if (!pawn || !*pawn) continue;
            auto team = mem.Read<int>(*pawn + offsets::m_iTeamNum);
            if (team && *team == localTeam) continue;
            auto hp2 = mem.Read<int>(*pawn + offsets::m_iHealth);
            auto sn2 = mem.Read<uintptr_t>(*pawn + offsets::m_pGameSceneNode);
            if (!sn2 || !*sn2) continue;
            float org[3] = {0,0,0};
            mem.ReadBuffer(*sn2 + offsets::m_vecAbsOrigin, org, sizeof(org));
            char nm[64] = {0};
            mem.ReadBuffer(*ctrl + offsets::m_iszPlayerName, nm, sizeof(nm)-1);
            snprintf(buf, sizeof(buf), "enemy[%d] hp=%d team=%d org=(%.1f %.1f %.1f) name=\"%s\"\n",
                i, hp2 ? *hp2 : -1, team ? *team : -1, org[0], org[1], org[2], nm);
            w(buf);
            dumped++;
        }
        snprintf(buf, sizeof(buf), "controllers found = %d\n", found); w(buf);
    }

    fclose(f);
}
