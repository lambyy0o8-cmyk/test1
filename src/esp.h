#pragma once
#include "memory.h"
#include <cstdint>
#include <vector>

struct Vec2 { float x, y; };
struct Vec3 { float x, y, z; };

struct Entity {
    uintptr_t pawn = 0;
    uintptr_t controller = 0;
    int health = 0;
    int team = 0;
    Vec3 origin{};
    char name[64]{};
    Vec2 screen{};
    bool valid = false;
};

class Esp {
public:
    explicit Esp(const Memory& mem) : mem_(mem) {}
    void Run(HDC target);

private:
    void BuildEntities();
    bool WorldToScreen(const Vec3& world, Vec2& out, const float matrix[4][4], int w, int h) const;
    void DrawOverlay(HDC hdc) const;

    const Memory& mem_;
    std::vector<Entity> entities_;
    float viewMatrix_[4][4]{};
    int screenW_ = 0, screenH_ = 0;
};
