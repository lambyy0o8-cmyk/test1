# ZeroScript

Бесплатное браузерное расширение, превращающее ChatGPT, DeepSeek, Gemini, Kimi, GLM, Qwen, Arena или Meta AI в AI-агента для Roblox Studio. Управляй Roblox Studio прямо из браузера: читай/редактируй скрипты, запускай Luau, генерируй ассеты - всё из обычного чата. Без API-ключей, терминала и кода.

## Что внутри

- `zeroscript-extension/` - само расширение (Chrome/Edge)
  - `core/` - парсер команд, конфиг, main-логика
  - `providers/` - адаптеры для каждого AI-провайдера (deepseek, chatgpt, claude, gemini, kimi, glm, qwen, arena, meta)
- `bridge.py` - локальный мост между расширением и Roblox Studio
- `launch_studio_mcp.py` - запуск MCP-сервера Studio
- `vscode_mcp_server.py` - MCP-сервер для VS Code
- `zeroscrip-rpc/` - Discord Rich Presence
- `deepseek-patcher/` - юзерскрипт-патчер
- `assets/` - иконки и баннер
- `start.bat` / `MacOS_Start.command` - запуск моста

## Как работает

```
AI-чат -> Расширение ZeroScript -> Мост (твой ПК) -> Roblox Studio
```

Расширение работает внутри страницы чата, шлёт команды мосту, мост управляет Studio через встроенный MCP.

## Установка

1. Скачай/клонируй репо
2. `edge://extensions` или `chrome://extensions` -> Режим разработчика -> Загрузить распакованное -> папка `zeroscript-extension`
3. Открой Roblox Studio + Place -> Assistant AI -> ... -> Manage MCP Servers -> Enable Studio as MCP Server
4. Запусти `start.bat` (Windows) или `MacOS_Start.command` (macOS)
5. Открой chat.deepseek.com (рекомендуется) и нажми Start session

## Провайдеры

DeepSeek (рекомендуется), ChatGPT, Gemini, Kimi, GLM, Qwen, Arena, Meta AI, Claude (локально).

## Возможности

- Чтение и редактирование скриптов
- Запуск Luau в Studio
- Инспекция дерева игры
- Генерация мешей/материалов/моделей
- Creator Store
- Управление play-test
- Память проекта между сессиями

## Требования

- Windows / macOS
- Roblox Studio (со встроенным MCP)
- Chrome / Edge
- Python 3.9+

## Лицензия

GPL-3.0 (см. LICENSE)

---

Оригинал: https://github.com/sebattfg/ZeroScript-Free
