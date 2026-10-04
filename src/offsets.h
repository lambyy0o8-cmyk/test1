#pragma once
#include <cstdint>

// CS2 offsets - a2x/cs2-dumper (2026-09-25).
namespace offsets {
    // client.dll signatures
    constexpr uintptr_t dwEntityList = 0x27151A8;
    constexpr uintptr_t dwLocalPlayerController = 0x2537628;
    constexpr uintptr_t dwLocalPlayerPawn = 0x25606D8;
    constexpr uintptr_t dwViewMatrix = 0x2565A20;
    constexpr uintptr_t dwPlantedC4 = 0x24C9290;
    constexpr uintptr_t dwGameRules = 0x255C8D8;

    // C_BaseEntity
    constexpr uintptr_t m_iHealth = 0x34C;
    constexpr uintptr_t m_iTeamNum = 0x3E7;
    constexpr uintptr_t m_lifeState = 0x354;
    constexpr uintptr_t m_pGameSceneNode = 0x330;

    // CGameSceneNode
    constexpr uintptr_t m_vecAbsOrigin = 0xC8;

    // CCSPlayerController
    constexpr uintptr_t m_hPlayerPawn = 0x92C;
    constexpr uintptr_t m_iszPlayerName = 0x6FC;
}
