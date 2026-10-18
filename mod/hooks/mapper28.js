// Маппер 28 — Action 53: на нём собраны сборники Action 53 и многие самодельные мультикарты для Денди.
// Написан по описанию и эталонной формуле NESdev, без чужого кода эмуляторов:
//   https://www.nesdev.org/wiki/Action_53_mapper
//   https://www.nesdev.org/wiki/Action_53_mapper/Reference_implementations
// Регистры: запись в $5000–$5FFF выбирает регистр (бит 7 — «супервизор», бит 0 — номер),
// запись в $8000–$FFFF пишет в выбранный: $00 — банк CHR RAM, $01 — внутренний банк ПЗУ,
// $80 — режим (отражение, режим банков, размер внешнего банка), $81 — внешний банк.
// Этот файл — общий: мод берёт его как модуль, сайт при сборке делает из него обычный скрипт.

const SIZE_MASKS = [0x01, 0x03, 0x07, 0x0f]

// Какой 16-килобайтный банк ПЗУ стоит на $8000 (a14 = 0) или $C000 (a14 = 1) — эталонная формула NESdev
export function prgBank(a14, mode, outer, inner) {
  let bankMode = mode >> 2 // биты отражения не нужны
  let current = inner
  const outerBank = outer << 1
  if (((bankMode ^ a14) & 0x03) === 0x02) bankMode = 0 // фиксированный банк UxROM — как NROM
  if ((bankMode & 0x02) === 0) current = (current << 1) | a14 // 32 КБ: A14 идёт во внутренний банк
  const mask = SIZE_MASKS[(bankMode >> 2) & 3]
  return (current & mask) | (outerBank & ~mask)
}

export function installMapper28(Mappers) {
  if (!Mappers || Mappers[28]) return
  const Base = Mappers[0]

  class Mapper28 extends Base {
    constructor(nes) {
      super(nes)
      this.select = 0
      // При включении на $C000 стоит последний банк ПЗУ: внешний банк — все единицы
      this.regs = [0, 0, 0, 0xff]
      this.prgLoaded = [-1, -1]
      this.chrBank = 0
      this.chrRam = [0, 1, 2, 3].map(() => new Array(8192).fill(0))
    }

    write(address, value) {
      if (address >= 0x5000 && address < 0x6000) {
        this.select = ((value >> 6) & 0x02) | (value & 0x01)
        return
      }
      if (address < 0x8000) {
        super.write(address, value)
        return
      }
      this.regs[this.select] = value
      // В одноэкранном отражении бит 4 записи в $00 или $01 выбирает экран
      if (this.select <= 1 && (this.regs[2] & 0x02) === 0) this.regs[2] = (this.regs[2] & ~0x01) | ((value >> 4) & 0x01)
      this.update()
    }

    update() {
      const [chr, inner, mode, outer] = this.regs
      const rom = this.nes.rom
      for (const a14 of [0, 1]) {
        const bank = prgBank(a14, mode, outer, inner) % rom.romCount
        if (bank !== this.prgLoaded[a14]) {
          this.loadRomBank(bank, a14 ? 0xc000 : 0x8000)
          this.prgLoaded[a14] = bank
        }
      }
      const mirroring = [rom.SINGLESCREEN_MIRRORING, rom.SINGLESCREEN_MIRRORING2, rom.VERTICAL_MIRRORING, rom.HORIZONTAL_MIRRORING][mode & 0x03]
      if (this.nes.ppu.currentMirroring !== mirroring) this.nes.ppu.setMirroring(mirroring)
      this.switchChr(chr & 0x03)
    }

    // 32 КБ CHR RAM в четырёх банках по 8 КБ: JSNES держит текущий банк в памяти PPU и кеше тайлов,
    // поэтому при смене банка текущий сохраняем, новый кладём на его место и пересчитываем тайлы
    switchChr(bank) {
      if (this.nes.rom.vromCount > 0 || bank === this.chrBank) return
      const ppu = this.nes.ppu
      ppu.triggerRendering()
      const saved = this.chrRam[this.chrBank]
      for (let i = 0; i < 8192; i++) saved[i] = ppu.vramMem[i]
      const next = this.chrRam[bank]
      for (let i = 0; i < 8192; i++) ppu.vramMem[i] = next[i]
      for (let address = 0; address < 8192; address += 16) {
        const tile = ppu.ptTile[address >> 4]
        for (let line = 0; line < 8; line++) tile.setScanline(line, next[address + line], next[address + line + 8])
      }
      this.chrBank = bank
    }

    loadROM() {
      if (!this.nes.rom.valid) throw new Error('Action 53: Invalid ROM! Unable to load.')
      this.prgLoaded = [-1, -1]
      this.update()
      this.loadCHRROM()
      this.loadBatteryRam()
      this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET)
    }
  }
  Mapper28.JSON_PROPERTIES = [...(Base.JSON_PROPERTIES || []), 'select', 'regs', 'prgLoaded', 'chrBank', 'chrRam']

  Mappers[28] = Mapper28
}
