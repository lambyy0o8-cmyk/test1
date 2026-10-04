cmake_minimum_required(VERSION 3.20)
project(cs2_external CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(cs2_external
    src/main.cpp
    src/memory.cpp
    src/esp.cpp
    src/menu.cpp
    src/overlay.cpp
    src/debug.cpp
)

target_link_libraries(cs2_external PRIVATE gdiplus user32 gdi32)

set_target_properties(cs2_external PROPERTIES WIN32_EXECUTABLE TRUE)

target_include_directories(cs2_external PRIVATE src)

if(MSVC)
    target_compile_options(cs2_external PRIVATE /W3 /EHsc)
endif()
