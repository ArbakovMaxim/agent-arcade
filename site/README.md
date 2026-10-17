# Arcade — сайт с каталогом игр

Сайт, который открывает мод Arcade для Claude Code: окно с библиотекой и играми, каталог и файлы игр. Только статика — ни базы, ни бэкенда. Хостинг — Cloudflare Pages.

## Как устроено

```
content/catalog.json   приставки и игры: описания, управление, где игра хранит счёт, лицензии
content/games/<id>/    ROM, текст лицензии и исходники каждой игры
web/                   окно Arcade: библиотека, игра, статистика, эмулятор Денди (JSNES)
build.mjs              собирает сайт в dist/
```

Сборка (`node build.mjs`) проверяет каталог и кладёт в `dist/`:

- `catalog.json` — каталог для окна и для мода;
- `files/<sha256>.nes` — файлы игр под именами-хешами: они не меняются, поэтому кешируются навсегда, а окно и мод сверяют скачанное с хешем;
- `files/<sha256>.nes.b64` — те же файлы в base64: мод в Claude Code скачивает файлы только как текст;
- `licenses/<id>/` — лицензии и исходники игр рядом с самими играми, как требует GPL;
- окно Arcade и `_headers` с правилами кеширования.

Ошибки в каталоге — нет файла, нет приставки, повтор id, адрес вне памяти, нет лицензии — останавливают сборку с понятным сообщением, так что битый каталог до пользователей не доходит.

## Добавить игру

1. Положи ROM, текст лицензии и исходники в `content/games/<id>/`.
2. Допиши игру в `content/catalog.json`: приставка, название, жанр, описание, управление, путь к ROM и лицензия (название, автор, ссылка на исходники, файлы). Если знаешь, где игра хранит счёт, добавь `score` — тогда окно будет вести рекорды.
3. Запушь — Cloudflare Pages соберёт и выложит сайт сам.

Брать можно только игры со свободной лицензией, которая разрешает распространение.

## Развернуть на Cloudflare Pages

1. Создай репозиторий на GitHub и запушь в него эту папку.
2. В панели Cloudflare: Workers & Pages → Create → вкладка Pages → Connect to Git → выбери репозиторий.
3. Настройки сборки:
   - Project name: `agent-arcade` (из него получится адрес `agent-arcade.pages.dev`);
   - Production branch: `main`;
   - Framework preset: None;
   - Build command: `node build.mjs`;
   - Build output directory: `dist`.
4. Save and Deploy. Дальше каждый пуш в `main` выкладывает сайт заново.

## Проверить

```bash
npm test             # сборка и окно — без браузера
node build.mjs       # собрать сайт в dist/
npx serve dist       # посмотреть его в браузере на http://localhost:3000
```

## Лицензии

- Сайт и скрипты — код проекта.
- **JSNES** 2.1.0, Apache-2.0: `third_party/jsnes/LICENSE.txt`.
- **Thwaite** © Damian Yerrick, GPL-3.0-or-later; **Concentration Room** © Damian Yerrick, GPL-3.0-or-later; **robotfindskitten** © Damian Yerrick и Leonard Richardson, zlib. Лицензии и исходники — в `content/games/<id>/`, на сайте — в `licenses/<id>/`.
