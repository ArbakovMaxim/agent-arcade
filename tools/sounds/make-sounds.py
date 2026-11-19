# Встроенные звуки Arcade (mod/sounds/*.wav): синтез из синусоид, без чужих записей — лицензия та же, что у Arcade.
# Запуск из корня репозитория: python tools/sounds/make-sounds.py
import math
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parents[2] / "mod" / "sounds"


def tone(freq, length, decay, partials=((1.0, 1.0),), attack=0.005):
    """Нота: сумма гармоник (множитель частоты, громкость) с затуханием exp(-t/decay)."""
    out = []
    for i in range(int(RATE * length)):
        t = i / RATE
        env = min(1.0, t / attack) * math.exp(-t / decay)
        out.append(env * sum(a * math.sin(2 * math.pi * freq * m * t) for m, a in partials))
    return out


def mix(parts, length):
    """Ноты на дорожке: [(начало в секундах, отсчёты)]."""
    buf = [0.0] * int(RATE * length)
    for start, samples in parts:
        at = int(RATE * start)
        for i, s in enumerate(samples):
            if at + i < len(buf):
                buf[at + i] += s
    return buf


def save(name, buf, peak=0.89):
    # Последние 20 мс — на ноль, чтобы не щёлкало; громкость — до пика -1 дБ
    fade = int(RATE * 0.02)
    for i in range(fade):
        buf[-1 - i] *= i / fade
    top = max(abs(s) for s in buf) or 1.0
    data = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s * peak / top)) * 32767)) for s in buf)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data)


BELL = ((1.0, 1.0), (2.0, 0.5), (2.76, 0.3), (5.4, 0.12))
BEEP = ((1.0, 1.0), (3.0, 0.18))

OUT.mkdir(parents=True, exist_ok=True)
# Перезвон: две ноты вниз, «динь-дон»
save("chime", mix([(0.0, tone(784.0, 1.0, 0.35, BELL)), (0.28, tone(659.3, 1.1, 0.4, BELL))], 1.4))
# Колокол: одна нота с долгим хвостом
save("bell", mix([(0.0, tone(880.0, 1.6, 0.5, BELL))], 1.6))
# Пульс: три коротких сигнала
save("pulse", mix([(k * 0.16, tone(1000.0, 0.09, 0.2, BEEP, 0.003)) for k in range(3)], 0.55))
# Подъём: арпеджио вверх
save("rise", mix([(k * 0.11, tone(f, 0.5, 0.18, BELL)) for k, f in enumerate((523.3, 659.3, 784.0, 1046.5))], 0.9))
# Будильник: два тона попеременно, громко и настойчиво
save("alarm", mix([(k * 0.14, tone(880.0 if k % 2 == 0 else 1174.7, 0.12, 0.5, BEEP, 0.003)) for k in range(8)], 1.2))
