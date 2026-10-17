# Arcade — игры, пока агент Claude Code работает

## site/

Сайт для Cloudflare Pages: каталог, окно Arcade, игры.

Настройки Pages:

- Root directory — `site`
- Build command — `node build.mjs`
- Build output directory — `dist`

Как добавить игру — в [site/README.md](site/README.md).

## mod/

Мод для Claude Code. Запуск:

```
claude --plugin-dir ./mod
```

Подробности — в [mod/README.md](mod/README.md).

## Лицензии

У каждой игры своя лицензия. Тексты лицензий и исходники лежат рядом с игрой.

## Установить мод

В любом Claude Code (терминал, VS Code, Desktop):

```
/plugin install arcade --marketplace ArbakovMaxim/agent-arcade
```

Маркетплейс — файл `.claude-plugin/marketplace.json` в корне этого репозитория, он указывает на мод в `mod/`.
