#!/usr/bin/env python3
"""Дерево сборки Heretic для браузера: doom-wasm (Cloudflare, GPL-2.0) + Chocolate Heretic.

doom-wasm — это Chocolate Doom с коммита 5b967edaf6 (5 апреля 2021), где общие файлы движка переделаны под
браузер (сеть через WebSocket — net_websockets.c, таймер, видео), а Heretic, Hexen и Strife убраны.
Здесь возвращаем Heretic из Chocolate Doom того же коммита и переносим в него единственную нужную правку:
главный цикл — через emscripten_set_main_loop, как в doom-wasm для Doom.

Запуск: prepare.py <doom-wasm> <chocolate-doom на 5b967edaf6> <куда сложить дерево>
"""
import shutil
import sys
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8', errors='surrogateescape')
    if text.count(old) != 1:
        sys.exit(f'{path}: ожидался ровно один фрагмент:\n{old}')
    path.write_text(text.replace(old, new), encoding='utf-8', errors='surrogateescape')


def main(doom_wasm: str, chocolate: str, out: str) -> None:
    src, choc, dst = Path(doom_wasm), Path(chocolate), Path(out)
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns('.git'))
    shutil.copytree(choc / 'src' / 'heretic', dst / 'src' / 'heretic')

    # Сборка: программа websockets-heretic рядом с websockets-doom, по тем же правилам
    makefile = dst / 'src' / 'Makefile.am'
    replace_once(makefile, 'SUBDIRS = doom\n', 'SUBDIRS = doom heretic\n')
    replace_once(makefile, 'execgames_PROGRAMS = @PROGRAM_PREFIX@doom\n', 'execgames_PROGRAMS = @PROGRAM_PREFIX@doom @PROGRAM_PREFIX@heretic\n')
    text = makefile.read_text(encoding='utf-8')
    start = text.index('if HAVE_WINDRES\n@PROGRAM_PREFIX@doom_SOURCES')
    end = text.index('@PROGRAM_PREFIX@doom_LDADD = doom/libdoom.a $(EXTRA_LIBS)\n') + len('@PROGRAM_PREFIX@doom_LDADD = doom/libdoom.a $(EXTRA_LIBS)\n')
    heretic_rules = text[start:end].replace('@PROGRAM_PREFIX@doom', '@PROGRAM_PREFIX@heretic').replace('doom/libdoom.a', 'heretic/libheretic.a')
    text = text[:end] + '\n' + heretic_rules + text[end:]
    if 'doom/libdoom.a:' in text and 'heretic/libheretic.a:' not in text:
        text += '\nheretic/libheretic.a:\n\t$(MAKE) -C heretic\n'
    makefile.write_text(text, encoding='utf-8')
    replace_once(dst / 'configure.ac', 'src/doom/Makefile\n', 'src/doom/Makefile\nsrc/heretic/Makefile\n')

    # Главный цикл: браузер не даёт крутить вечный цикл — кадр отдаём ему через emscripten_set_main_loop.
    # Цикл нужно завести до запуска видео, иначе emscripten_set_main_loop_timing в I_InitGraphics ругается.
    d_main = dst / 'src' / 'heretic' / 'd_main.c'
    replace_once(d_main, '#include <stdio.h>\n', '#include <stdio.h>\n#include <emscripten.h>\n')
    replace_once(
        d_main,
        'void D_DoomLoop(void)\n{\n',
        '// Arcade: один кадр игры — то, что раньше было телом while (1) в D_DoomLoop\n'
        'static void D_RunFrame(void)\n{\n'
        '    // Frame syncronous IO operations\n'
        '    I_StartFrame();\n\n'
        '    // Process one or more tics\n'
        '    // Will run at least one tic\n'
        '    TryRunTics();\n\n'
        '    // Move positional sounds\n'
        '    S_UpdateSounds(players[consoleplayer].mo);\n'
        '    D_Display();\n'
        '}\n\n'
        'void D_DoomLoop(void)\n{\n',
    )
    replace_once(
        d_main,
        '    I_GraphicsCheckCommandLine();\n    I_SetGrabMouseCallback(D_GrabMouseCallback);\n    I_InitGraphics();\n',
        '    I_GraphicsCheckCommandLine();\n    I_SetGrabMouseCallback(D_GrabMouseCallback);\n'
        '    // Arcade: цикл заводим до запуска видео, как в doom-wasm\n'
        '    emscripten_set_main_loop(D_RunFrame, 0, 0);\n'
        '    I_InitGraphics();\n',
    )
    replace_once(
        d_main,
        '    main_loop_started = true;\n\n    while (1)\n    {\n        // Frame syncronous IO operations\n        I_StartFrame();\n\n'
        '        // Process one or more tics\n        // Will run at least one tic\n        TryRunTics();\n\n'
        '        // Move positional sounds\n        S_UpdateSounds(players[consoleplayer].mo);\n        D_Display();\n    }\n}\n',
        '    main_loop_started = true;\n    // Arcade: дальше кадры вызывает браузер (D_RunFrame)\n}\n',
    )
    print(f'дерево сборки Heretic готово: {dst}')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
