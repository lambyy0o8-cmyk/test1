# LamByy desktop

Отдельное десктоп-приложение: чат **через открытую вкладку DeepSeek** (не через API-ключ) + панель управления bridge.

## Как работает

Приложение подключается по WebSocket к `bridge.py` (порт 17613) и шлёт `deepseek_chat` — мост передаёт сообщение в твою вкладку DeepSeek с расширением ZeroScript, ждёт ответ и возвращает текст в окно.

**Перед работой:** открой `chat.deepseek.com` в браузере, чтобы расширение было активно и сессия агента запущена.

## Запуск

```
cd lamyy-app
npm install
npm start
```

`npm install` ставит `electron` и `ws`. Если bridge запускается на другом порту — задай `ZS_BRIDGE_PORT` при старте.

## Функции в панели

- **⟳ Перезапустить bridge** — запускает `../restart_bridge.py`.
- **🧰 Список команд** — сколько tools доступно и какие MCP-серверы подключены.
- **📜 Лог действий / 🐞 Debug / ⚠ Ошибки** — открывает файл из `../logs/`.

## Статус

● зелёная — bridge отвечает и Roblox подключён, жёлтая — bridge есть, Studio нет, серая — bridge оффлайн.

## Файлы

```
lamyy-app/
├── main.js          # Electron main: окно, WebSocket к bridge, IPC
├── preload.js       # мост renderer ↔ main
├── package.json
└── renderer/
    ├── index.html
    ├── style.css
    └── app.js
```
