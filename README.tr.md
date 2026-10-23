<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Arcade logosu" align="right">

# Arcade — Claude Code ajanın çalışırken oyna, oku, dinle ve izle

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · **Türkçe** · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Alfa (0.25).** Arcade çalışıyor ve her gün kullanılıyor, ama bu erken bir sürüm: bir şeyler bozulabilir, ayarlar ya da katalog güncellemeler arasında değişebilir. Hata bildirimlerine çok seviniriz — bkz. [Geri bildirim](#geri-bildirim).

Arcade, ajanın çalışırken bekleme süresini dolduran bir [Claude Code](https://claude.com/claude-code) eklentisidir. Ajan 10 saniyeden uzun süre meşgul olduğunda, istemin üstünde küçük bir *«oynamak ister misin?»* belirir. Bir şeyler oyna — NES, Sega, PlayStation, Doom, satranç ve daha fazlası —, bir kitap oku, bir sesli kitap ya da podcast dinle veya ajanın üzerinde çalıştığı konuyla ilgili bir video izle. Ajan işini bitirdiği ya da iznine ihtiyaç duyduğu anda Arcade sana haber verir — hiçbir şeyi kaçırmazsın.

Katalogdaki her şey ücretsiz: oyunlar açık lisanslı, kitaplar ve sesli kitaplar kamu malı. Ajanlarını bekleyen başka kişilerle çevrim içi oynayabilir ve arkadaşlarınla sohbet edebilirsin.

![Ajan 11 saniye çalıştıktan sonra Claude Code isteminin üstünde «oynamak ister misin?»](docs/images/prompt.png)

## Özellikler

- **Kendiliğinden belirir.** Ajan 10 saniye çalıştıktan sonra Arcade istemin üstünde bir oyun önerir; sen istemedikçe odağı asla almaz.
- **Ajanın ne yaptığını bilir.** Ajan bitirdiğinde ya da izin istediğinde oyunun üstünde bir bildirim çıkar — oynamaya devam et, duraklat ya da doğrudan ajana dön (davranışı ayarlardan seçersin).
- **Tek menü, beş bölüm.** *Oyna*, *Oku ve dinle*, *İzle*, *Sosyal* ve *Diğer* — ihtiyacın olmayanları daralt. En üstte: son oyuna *Devam et*, *Ara* ve *Favoriler*.
- **61 ücretsiz oyun:** NES (Dendy), Sega Mega Drive, Master System, PlayStation ve arcade oyunları, nişancı, yarış, strateji, macera ve masa oyunları içeren bir *Oyunlar* sekmesi.
- **Oku ve dinle.** 136 kamu malı kitap, LibriVox sesli kitapları, ajanın üzerinde çalıştığı konuyla ilgili yeni makaleler ve podcast bölümleri.
- **İzle.** Ajanın üzerinde çalıştığı konuyla ilgili yeni YouTube videoları ve Twitch: kendi kanalların ile programlama, teknoloji, bilim ve retro oyunlar üzerine canlı yayınlar.
- **NES ve Flappy Arcade doğrudan Claude Code içinde** — terminalde, VS Code’da ve Claude Desktop’ta. Geri kalan her şey bir tarayıcı penceresinde açılır; Claude Desktop’ta varsayılan olarak Claude’un yerleşik tarayıcısında (nişancı oyunları yine de tarayıcı penceresinde açılır: yerleşik tarayıcı fareyi yakalayamaz).
- **Çevrim içi oyun.** Ağ üzerinden iki kişilik konsol oyunları, Doom’da deathmatch ve co-op, insanlara ya da bilgisayara karşı satranç, go, dama ve reversi.
- **«Çevrim içi kim bekliyor».** Biri oyun arkadaşı beklediğinde Arcade bunu Claude Code’da bir *Katıl* düğmesiyle gösterir.
- **Arkadaşlar ve sohbetler.** İsteğe bağlı GitHub girişi ayarlarını tüm bilgisayarlarında aynı tutar ve sana bir @takma ad verir; arkadaşlarını tam takma adlarıyla ekle, ikili ya da grup halinde sohbet et.
- **Arama ve favoriler.** Oyunlar, kitaplar, sesli kitaplar ve Twitch kanallarında tek bir arama, bölüme ve türe göre gruplanmış; *★ Favoriler*’de tutmak için herhangi bir şeyi ☆ ile işaretle.
- **Kendi oyunların.** Sahip olduğun ROM’ları ekle; bilgisayarında kalırlar.
- **13 arayüz dili:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — sistem ya da tarayıcı diline göre, varsayılan İngilizce.

## Kurulum

**Claude Code 2.1.275 veya daha yenisi** gerekir.

Terminalde iki komut: Arcade marketplace’ini (bu depo) ekle, ardından eklentiyi oradan kur:

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

Ya da bir Claude Code oturumunun içinde:

```
/plugin marketplace add ArbakovMaxim/agent-arcade
/plugin install arcade@agent-arcade
```

Eklenti tüm oturumlar ve uygulamalar için kurulur. VS Code eklentisinde `/plugin` komutu yok — terminalden kur, VS Code eklentisi yeni bir sohbette onu algılar.

**Güncelleme:**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

**Kaldırma:** `/plugin uninstall arcade@agent-arcade`

## Kullanım

- **`/arcade`** menüyü istediğin an açar.
- Ajan 10 saniyeden uzun çalıştığında istemin üstünde *«oynamak ister misin?»* belirir: **`1`** — burada, panelde oyna; **`2`** — bir tarayıcı penceresinde (olan yerlerde); **`3`** — şimdi değil.
- Seçmek için oklar ya da Tab, açmak için Enter; fare de çalışır. Kontroller her oyunun altında yazılı.
- Ajan bitirdiğinde ya da izin beklediğinde oyunun üstünde bir bildirim çıkar: **Ajana dön** ya da **Oynamaya devam et**.

### Menü

| Bölüm | İçinde ne var |
|---|---|
| *(en üst)* | Son oyuna **▶ Devam et**, **🔍 Ara**, **★ Favoriler** |
| **Oyna** | NES, Sega, Master System, PlayStation, Oyunlar; biri çevrim içi beklerken *Katıl*; **Oyunlarım** |
| **Oku ve dinle** | Kitaplar, Sesli kitaplar, Makaleler, Podcast’ler |
| **İzle** | YouTube, Twitch |
| **Sosyal** | Arkadaşlar, Sohbetler, **GitHub ile giriş yap** (giriş yaptıktan sonra **Hesap**) |
| **Diğer** | Arcade penceresi, Ayarlar, 🌐 dil, 🐞 Hata bildir, ☕ Projeye destek ol |

Bir bölümü daraltmak ya da genişletmek için başlığına tıkla. Daraltılmış bölüm `▸` ve içindeki kutucuk sayısını gösterir; *Sosyal* ayrıca yeni mesajları 💬 ve arkadaşlık isteklerini 👥 gösterir. Arcade hangi bölümlerin daraltıldığını hatırlar. Giriş yaptıktan sonra menü başlığı @takma adını aynı sayaçlarla gösterir.

**Arama** iki harften itibaren başlar ve büyük-küçük harf ile aksanlara bakmadan başlık, yazar ya da tür bulur. Sonuçlar bölüme ve türe göre gruplanır, örneğin *Kitaplar · Polisiye* ya da *Oyunlar · Nişancı*. Bir oyun, kitap ya da sesli kitabın yanındaki ☆ yıldızı onu **★ Favoriler**’e ekler (en fazla 100); favoriler bölüme ve türe göre sıralanır, en yeniler önce.

### Ne nerede açılır

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, diğer Oyunlar; kitaplar, sesli kitaplar, makaleler, podcast’ler, videolar |
|---|---|---|
| **Terminal** | panelde (terminal destekliyorsa piksel grafik, değilse metin blokları) | tarayıcı penceresi |
| **VS Code** | panelde | tarayıcı penceresi |
| **Claude Desktop** | panelde | Claude’un yerleşik tarayıcısı ya da tarayıcı penceresi (ayarlardan seçilir); nişancı oyunları — her zaman tarayıcı penceresi |

Tarayıcı penceresi ayrı bir Arcade penceresidir (varsayılan tarayıcında ya da ayarlarda seçtiğin tarayıcıda), sıradan sekmelerinin arasında bir sekme değil. Sohbetler doğrudan panelde çalışır — terminalde ve Desktop’ta; *Sayfada aç* onları sitede aynı şekilde açar.

## Katalog

| Sekme | İçinde ne var |
|---|---|
| **NES (Dendy)** | 28 homebrew oyun — platform, bulmaca, nişancı, yarış: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical ve diğerleri |
| **Sega** | 11 Mega Drive oyunu: Miniplanets, Tank Battle, Battle 4Tris, Pong ve diğerleri |
| **Master System** | 4 oyun: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Oyunlar → Arcade oyunları** | Flappy Arcade — Arcade’in kendi tek tuşlu oyunu: doğrudan panelde ve Arcade penceresinde çalışır; günün parkuru herkes için aynıdır, rekorun kaydedilir |
| **Oyunlar → Nişancı** | Freedoom Phase 1 ve 2 (Doom’un özgür alternatifleri), FreeDM deathmatch, Blasphemer (Heretic’in özgür alternatifi), BlasphDM deathmatch |
| **Oyunlar → Yarış** | HexGL — fütüristik yerçekimsiz yarış |
| **Oyunlar → Strateji** | OpenTTD — ulaşım imparatorluğu (GPL-2.0); Micropolis — 1989’un klasik şehir kurma oyununun açık kaynak kodu, şehrin tarayıcıda kaydedilir (micropolisJS, ek koşullarla GPL-3.0 ve Micropolis Public Name License) |
| **Oyunlar → Macera** | ScummVM’de (GPL-3.0-or-later) 90’ların dört ücretsiz klasik macera oyunu: Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress ve Nippon Safes, Inc. — izinle dağıtılabilen freeware oyun verileri; F5 ile istediğin an kaydet |
| **Oyunlar → Masa oyunları** | Satranç — insanlara ya da bilgisayara karşı (Stockfish, 1–10 seviye), çevrim içi saatli; 9×9, 13×13 ve 19×19 tahtalarda go; Rus daması, reversi; hepsinde *Terk et* |
| **Kitaplar** | Dil raflarında, türe göre dizilmiş 136 kamu malı klasik: 98’i İngilizce (Austen, Dickens, Twain, Conan Doyle, Wells, Shelley, çeviride Tolstoy ve Dostoyevski…) ve 38’i Ukraynaca (Franko, Lesya Ukrainka, Kotsyubynsky, Kotlyarevsky, Kulish…). Ayraç kendiliğinden konur: kitabı yeniden aç, kaldığın yerden devam edersin. Kendi EPUB, FB2 ve TXT dosyaların Arcade penceresinde açılır |
| **Sesli kitaplar** | Dil raflarında, türe göre dizilmiş LibriVox’un kamu malı kayıtları: İngilizce Oscar Wilde ve O. Henry, Ukraynaca Gogol. Arcade penceresindeki oynatıcı kaldığın yeri hatırlar; kendi MP3, M4A, M4B, OGG ve Opus dosyaların da orada açılır ve tarayıcında kalır |
| **Makaleler** | Seçilmiş 106 İngilizce blog ve yayından yeni makaleler — Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security ve diğerleri |
| **Podcast’ler** | 65 İngilizce podcast’in yeni bölümleri — Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries ve diğerleri; her bölüm kaldığın yeri hatırlar |
| **YouTube** | Yapay zekâ, web ve DevOps’tan bilime, uzaya ve retro bilgisayarlara kadar 24 alanda seçilmiş 153 kanaldan yeni videolar |
| **Twitch** | *Kanallarım* — adıyla ya da bağlantısıyla herhangi bir Twitch kanalı, yayında olanlar önce; *Şu an yayında* ve *Tüm katalog* — seçilmiş 26 İngilizce kanal, 18+ kanal yok; kayıt gerekmez |

Her oyunun kartı lisansına ve kaynak koduna bağlantı verir.

**Konular.** Makaleler, Podcast’ler ve YouTube konularla başlar: Haiku, ajanın üzerinde çalıştığı şeyle ilgili üç konu önerir, artı *Yenilikler ve tanıtımlar*. *Kendi konun*’a ne izlemek, okumak ya da dinlemek istediğini herhangi bir dilde yazabilirsin; son beş konun *Konularım*’da kutucuk olarak kalır.

## Çevrim içi oyun

- **Konsollar.** NES, Sega, Master System ve PlayStation’daki iki kişilik oyunlarda **Çevrim içi** düğmesi var: bir oda oluştur ya da başkasının odasına katıl. Kontroller Arcade sunucusu üzerinden kare kare eşitlenir.
- **Doom.** **FreeDM** ve **BlasphDM**, en fazla dört oyuncu için 5 dakikalık turlarla deathmatch lobileridir; **Freedoom** ve **Blasphemer** **Çevrim içi** üzerinden co-op sunar. Yeni gelenler bir sonraki turu bekler — motor süren bir maça katılmaya izin vermez.
- **Masa oyunları.** *Rakip bul*, bağlantıyla *Arkadaşını davet et* ya da *Bilgisayara karşı*. Oyun sunucuda saklanır: hamleni yap, ajanına dön, bağlantıyı sonra aç — tahta bıraktığın gibi durur. @takma adla giriş yaptıysan rakibin onu senin renginin yanında görür.
- **Kim bekliyor.** Arcade dakikada bir, oyun arkadaşı bekleyen biri olup olmadığını kontrol eder ve bunu Claude Code’da gösterir — örneğin *«oynamak ister misin? Çevrim içi bekleyen var: FreeDM (1)»* — menüde bir **Katıl** düğmesiyle.

## Hesap, arkadaşlar ve sohbetler

Giriş yapmak isteğe bağlı — giriş yapmadan da her şey eskisi gibi çalışır.

- **GitHub ile giriş yap** (*Sosyal* içinde): Arcade bir kod gösterir, sen de bu kodu her zamanki tarayıcında GitHub sayfasına girersin. Arcade yalnızca GitHub profilinin adını ve resmini öğrenir — e-posta yok, depolara erişim yok.
- **Eşitleme.** Dil, tuşlar, bildirimler, panel boyutu, ajan haber verdiğinde oyunla ne yapılacağı, konuların, Twitch kanalların, favorilerin, daraltılmış bölümler ve Flappy Arcade rekorun tüm bilgisayarlarında aynı olur. Kendi oyunların, tarayıcı ve grafik modu her bilgisayarda ayrı kalır.
- **@takma ad.** GitHub adını tek tıkla al ya da kendin uydur: 4 ila 32 karakter — Latin harfleri, rakamlar ve `_`. Günde en fazla 5 kez değiştirebilirsin.
- **Arkadaşlar.** Bir arkadaşını tam @takma adıyla ekle: istek karşı tarafta kabul edilir ve birbirinizin listesinde görünürsünüz. Yazarken öneri çıkmaz, bu yüzden kimse Arcade’i kimlerin kullandığına göz atamaz. Reddetmek ve silmek sessizce olur.
- **Sohbetler.** Bir arkadaşınla ikili, arkadaş grupları ya da tek tıkla tüm arkadaşlarınla bir grup. Doğrudan Arcade panelinde yaz ya da sitedeki sohbet sayfasını aç. Mesajlar Arcade sitesinde saklanır ve şifrelenmez — oraya parola ya da anahtar yazma.
- **Çıkış yap** bu bilgisayarda eşitlemeyi durdurur; **Hesabı sil** (iki kez bas) sitenin seni ve ayarlarını unutmasını sağlar.

## Kendi oyunların

- **`/arcade-add <dosya>`** bir NES, Mega Drive ya da Master System ROM’u ekler (en fazla 4 MB). Eklenti bir kopyasını `~/.claude/arcade` içinde tutar ve hiçbir yere yüklemez.
- **PlayStation diskleri ve Doom WAD’ları** (örneğin kendi `doom.wad` dosyan) — Arcade penceresinde: **Kendi dosyanı aç**. Yalnızca o tarayıcıda kalırlar.

Yalnızca hakkına sahip olduğun dosyaları ekle.

## Ayarlar

`/arcade` menüsünün *Diğer* bölümünden **Ayarlar**’ı aç:

- **Dil** — 13 dilden biri (menüde doğrudan da: 🌐).
- **Oyunları aç** — burada panelde, bir tarayıcı penceresinde ya da belirli bir tarayıcıda; Claude Desktop’ta — Claude’un yerleşik tarayıcısında ya da bir tarayıcı penceresinde.
- **Grafik** (terminal) — resim gösterebilen terminallerde (kitty, Ghostty, Rio) piksel, diğer her yerde metin blokları.
- **Panel boyutu** — normal ya da tam genişlik.
- **Ajan bitirdiğinde** — bildirim ve oynamaya devam, bildirimle duraklatma ya da doğrudan ajana dönüş.
- **Ajan izin istediğinde** — aynı üç seçenek.
- **Pencerede oynarken bildirimler.**
- **Tuş testi ve tuş atama** (terminal).

## Gizlilik

- Reklam yok, analiz yok, takip yok. Analiz koduyla gelen oyunlar bundan arındırıldı (her oyunun `NOTICE` dosyasına bak).
- Kendi ROM’ların, WAD’ların, kitapların ve ses dosyaların bilgisayarından ya da tarayıcından asla çıkmaz.
- Çevrim içi oyun Cloudflare üzerindeki Arcade sunucusundan geçer: mesajlar bir odadaki oyuncular arasında aktarılır ve saklanmaz — geri dönebilmen için tutulan masa oyunu hamleleri hariç; bir ay boyunca dokunulmayan oyun silinir.
- Konuları kendi Claude Code oturumunda Haiku önerir; Arcade sitesi sohbetini asla görmez — *Kendi konun*’u kullandığında yalnızca kısa bir İngilizce arama sorgusu gider. Bir makalenin adresi `#` işaretinden sonra gelir, bu yüzden Arcade sunucusuna asla ulaşmaz.
- Giriş yaptıktan sonra site eşitlenen ayarlarını, favorilerini, @takma adını, arkadaşlarını ve sohbetlerini saklar. Oturum anahtarı yalnızca Arcade sitesine gönderilir.
- Bir hata raporu metnini, Arcade sürümünü, nerede açık olduğunu, arayüz dilini ve işletim sistemini içerir — başka hiçbir şey; giriş yapmadan imzasız gider ve site hiçbir adres saklamaz.
- Bazı oyunlar internete yalnızca sen istersen çıkar — örneğin OpenTTD’nin isteğe bağlı anketi ve *Online Content* düğmesi.

## Platformlar ve durum

Arcade **alfa** aşamasında ve aktif olarak geliştiriliyor — bkz. [değişiklik günlüğü](CHANGELOG.md).

- Windows, macOS ve Linux’ta canlı olarak denendi.
- Terminalde, VS Code’da ve Claude Desktop’ta çalışır.

## Lisanslar

- **Oyunlar:** her oyunun kendi özgür lisansı var (MIT, GPL, BSD, Apache, Creative Commons ve diğerleri) — lisans metni ve kaynak kodu oyunun yanında durur ve kartından bağlantı verilir.
- **Kitaplar ve sesli kitaplar:** kamu malı — İngilizce kitaplar Project Gutenberg’den, Ukraynaca kitaplar Vikikaynak’tan, kayıtlar LibriVox’tan; her kitabın kaynağını belirten bir `LICENSE.txt` dosyası var.
- **Emülatörler ve motorlar:** JSNES (Apache-2.0), çekirdekleriyle EmulatorJS (GPL-3.0), PrBoom (GPL-2.0), Cloudflare’in doom-wasm’ı ve Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (ek koşullarla GPL-3.0), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — satranç rakibi. Sega ve Master System için kullanılan Genesis Plus GX çekirdeği yalnızca ticari olmayan kullanım içindir.
- **Arcade’in kendi kodu** (eklenti ve site) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Onu özgürce kullanabilir, inceleyebilir ve değiştirebilirsin. Değiştirilmiş bir sürümü dağıtırsan — ya da başkaları için çevrim içi hizmet olarak çalıştırırsan —, tüm kaynak kodunu aynı lisansla yayımlaman ve telif hakkı bildirimlerini koruman gerekir. Üçüncü taraf bileşenler kendi lisanslarını korur.

## Projeye destek ol

Arcade ücretsiz. Beklemelerini daha keyifli hale getiriyorsa projeye bir kahve ısmarlayabilirsin — tamamen isteğe bağlı: **[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**. Aynı bağlantı `/arcade` menüsünün altında (*☕ Projeye destek ol*) ve Arcade penceresinde de var. Arcade’de hiçbir şey buna bağlı değil ve bir oyunu asla bölmez.

## Geri bildirim

Bir hata mı buldun? En hızlı yol doğrudan Arcade’den: **Diğer → 🐞 Hata bildir**. Neyin bozulduğunu anlat, rapor sürüm, ortam, dil ve işletim sistemi bilgisiyle birlikte doğrudan Arcade’in yazarına gider.

Ayrıca bir [issue](https://github.com/ArbakovMaxim/agent-arcade/issues) açabilirsin — hatalar ve fikirler için. İşletim sistemini, Claude Code ortamını (terminal, VS Code ya da Desktop) ve oyunu belirt.

Pull request’ler memnuniyetle karşılanır. Bir tane gönderdiğinde katkının AGPL-3.0 altında lisanslanmasını ve yazarın Arcade’i başka koşullarla da (örneğin ticari bir lisansla) sunabilmesini kabul etmiş olursun.

## Geliştiriciler için

```
mod/     Claude Code eklentisi (hook'lar, panel arayüzü, testler)
site/    Cloudflare Workers üzerindeki site: katalog, Arcade penceresi, ağ odaları, hesaplar, arkadaşlar, sohbetler, hata raporları
tools/   derleme araçları: kitaplar, sesli kitaplar, çeviriler, heretic-wasm
.github/ doom-wasm, heretic-wasm, OpenTTD ve ScummVM'i tarayıcı için derleyen GitHub Actions
```

- Eklentiyi depodan çalıştırmak: `claude --plugin-dir ./mod`
- Eklenti testleri: `claude plugin validate ./mod`, ardından `mod/` içinde `claude plugin test`
- Site testleri: `site/` içinde `npm test`; derleme: `node build.mjs`; dağıtım `main` dalından Cloudflare Workers Builds ile otomatik yapılır.
- Kitaplar: `node tools/books/build.mjs` katalogdaki kitapları indirir ve temizler (liste — `tools/books/books.json`).
- Çeviriler: `node tools/i18n/collect.mjs`, ardından `node tools/i18n/check.mjs` — bkz. [tools/i18n/README.md](tools/i18n/README.md).

Ayrıntılı belgeler (Rusça): [mod/README.md](mod/README.md) — eklenti, [site/README.md](site/README.md) — site, oyun ekleme ve ağ üzerinden oyun.
