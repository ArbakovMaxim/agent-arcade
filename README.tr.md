<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Arcade logosu" align="right">

# Arcade for Claude Code — Claude’un kart kart ilerlediği panolar

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · **Türkçe** · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Beta.** Burada anlatılan her şey çalışıyor ve her gün kullanılıyor. Hata bildirimlerine çok seviniriz — bkz. [Geri bildirim](#geri-bildirim).

Görevlerini bir panoya koy ve *Claude için kuyruk* düğmesine bas: Claude kartları birer birer alır, kontrol listesini işaretler ve sonucu karta yazar — tek bir oturumda ya da aynı anda birkaçında; iki oturum asla aynı kartı almaz. *Ajanlar*, bilgisayarındaki Arcade açık tüm Claude Code oturumlarını gösterir: çalışıyor, izin bekliyor ya da bitti. Ayrıca Claude’un seninle birlikte tuttuğu bir defter ve takvim, ekibin için ortak panolar ve sohbetler, bekleme için de oyunlar, kitaplar ve videolar var. Ücretsiz ve açık kaynak.

Katalogdaki her şey ücretsiz: oyunlar açık lisanslı, kitaplar ve sesli kitaplar kamu malı. Ajanlarını bekleyen başka kişilerle çevrim içi oynayabilir ve arkadaşlarınla sohbet edebilirsin.

![Demo: Claude Desktop’ta bir proje panosu; bir kart kontrol listeli bir sayfa olarak açılır, «Claude’a ver» onu Claude’a iletir, Claude her maddeyi işaretler, sonucu karta yazar ve kartı «Bitti» sütununa taşır](https://github.com/user-attachments/assets/c6519d8f-2bb5-4af2-9ebf-c4bfa5c144c6)

*Panon: bir kart tek tuşla Claude’a gider, arayüz İngilizce. [31 saniyelik videoyu izle](https://github.com/user-attachments/assets/c9076e68-2db6-4f68-9d88-8a132ce96f6a).*

**Kurulum** — terminalde:

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

Ya da Claude Code içinde: `/plugin marketplace add ArbakovMaxim/agent-arcade`, ardından `/plugin install arcade@agent-arcade`. Claude Code 2.1.275 veya daha yenisi gerekir. [Kurulum ve güncelleme hakkında daha fazlası](#kurulum)

![Demo: Claude Code’a bir görev verilir, istemin üstünde «oynamak ister misin?» belirir, sohbetin yanında bir NES oyunu çalışır ve ajan bitirince Arcade seni geri çağırır; kitaplar, sesli kitaplar ve makaleler de var](https://github.com/user-attachments/assets/3d8f79ac-966f-4872-84d5-7aa91534330d)

*Ajan çalışırken: Claude Desktop’ta 31 saniye, arayüz İngilizce. [Videoyu 720p izle](https://github.com/user-attachments/assets/bbb14c28-2813-40c0-82e6-d7375ddc2253).*

## Özellikler

- **Defter ve proje panoları.** Claude’un da tuttuğu sayfalar, alt sayfalar ve kontrol listeleri, sütunlu ve kartlı panolar. *Claude'a ver* bir sayfayı ya da kartı Claude’a iletir: Claude yapılanları işaretler ve sonucu oraya yazar. Bir sayfayı ya da kartı bir proje klasörünün notları olarak işaretle; o klasördeki her yeni Claude Code oturumu onun metniyle başlar. Sayfa ya da kart, metnini *Düzenle* ve *Kopyala* düğmeleriyle biçimlendirilmiş olarak gösterir. Açık tüm Claude Code oturumları defteri paylaşır, böylece her biri aynı panodan kendi kartını alabilir. Bir panoyu arkadaşlarınla paylaş, herkes aynı pano üzerinde çalışsın. Claude’un bağlayıcılarıyla bir sayfayı Notion’a ya da başka bir uygulamaya gönder veya oradan al; Claude’un giriş kutusuna dikte et ve metni bir sayfaya taşı.
- **Claude panondaki işleri sırayla halleder.** *Claude için kuyruk* ilk sütundaki kartları Claude’a tek tek verir: bir önceki *Bitti*’ye geçince sıradaki gider, Claude’un bir sorusu ya da yarım kalan bir kart da kuyruğu durdurur. Biten bir kartta Claude’un değiştirdiği dosyaları ve diff’lerini görürsün; sonra kartı kabul eder ya da yorumla geri gönderirsin. Kartların takvimde görünen son tarihleri vardır, ortak panoda da kimin hangi kartı üstlendiğini herkes görür. GitHub, Linear, Jira ya da başka bir takip aracındaki issue’ları panoya kart olarak getir ve sonucu, Claude’un bağlayıcılarıyla issue’ya yorum olarak geri yaz. *Günün özeti* bir stand-up sayfası hazırlar — Claude’a ne gitti, ne bitti, ne sürüyor — ekibinin sohbetine göndermen için.
- **Promptlar.** Tekrar tekrar yazdığın istekler tek basışla giden şablonlara dönüşür: bir şablona basınca *Claude'a ver* gibi Claude’a gider, *Giriş kutusuna* ise önce onu tamamlamanı sağlar. Bir seti arkadaşlarınla paylaş, tüm ekip aynı promptları kullansın. Claude da şablon kaydeder: «bunu Arcade’de prompt olarak kaydet».
- **Bugün.** *İş* bölümündeki ilk kutucuk seni bekleyen her şeyi tek ekranda toplar: izin ya da yanıt bekleyen oturumlar (seçenekli bir soru orada hemen yanıtlanır), bugünün etkinlikleri, son tarihi bugün olan ya da geçmiş kartlar, ortak panolarda üstlendiğin kartlar, okunmamış sohbetler ve Claude limitlerinin bir satırı. Sen yokken yanıtını bitiren oturumlar, Claude'un yanıtının başıyla birlikte ayrı bir blokta.
- **Ajanlar.** *İş* bölümündeki *Ajanlar*, bu bilgisayarda Arcade açık her Claude Code oturumunu klasörüne göre gösterir: çalışıyor, arka planda çalışıyor (Claude’un alt ajanları hâlâ çalışıyor), izin bekliyor, yanıtını bitirdi ya da boşta, ne kadar süredir öyle olduğu, kartı ve kuyruktaki yeri. Başka bir oturumdaki Claude seçenekli bir soru sorduğunda, onu doğrudan o oturumun kartındaki bir düğmeyle yanıtlarsın. Başka bir oturum izin istediğinde ya da soru sorduğunda kendi panelinde kısa bir uyarı bunu söyler; sesli bir sistem bildirimi de Claude Code simge durumundayken bile sana ulaşır. Bir panonun kuyruğu aynı anda birkaç oturumda çalışabilir ve iki oturum aynı kartı almaz. Her kart oturumun git dalını ve commit edilmemiş dosyalarını da gösterir; iki oturum aynı dosyayı düzenlerse uyarır. Yanıtını bitiren bir oturum, Claude'un yanıtının ilk sözlerini, ne zaman bitirdiğini ve kaç dosya değiştirdiğini gösterir.
- **Limitler.** *İş* bölümündeki *Limitler* kutucuğu Claude’un limit pencerelerini — 5 saat, hafta ve harcama limiti — yüzde, çubuk ve her birinin sıfırlanma saatiyle, ayrıca bu ve diğer oturumlarının bağlamını ve maliyetini gösterir. Rakamlar Claude Code’un kendisinden gelir. Bir panonun kuyruğunun ortasında limit biterse, tek bir düğme kuyruğu sıfırlamadan sonra sürdürür. 5 saatlik ve haftalık pencerelerin altında bir satır, pencerenin şu anki hızla aşağı yukarı ne zaman biteceğini söyler.
- **Takvim.** Desktop’ta aynı boyda gün kutucuklarından bir ay, her etkinliğin renginde bir noktayla; terminalde ve VS Code’da yaklaşanların listesi. Bir etkinlik tek satırla eklenir, örneğin «fri 9:30 standup», ve her gün, hafta içi, her hafta, her ay ya da her yıl tekrarlanabilir. Rengini ve ne zaman hatırlatılacağını listeden ya da kendi sözlerinle seç (örneğin «45 min before» ya da «the day before at 20:00»); hatırlatma sistem bildirimi olarak gelir. Pano kartlarının son tarihleri de burada görünür. Claude da etkinlik ekler ve değiştirir: «cuma 15:00’e bir görüşme ekle». Bir etkinliğin saatinde Arcade, Claude’a bir görev verebilir: bir panonun kuyruğu, tek bir kart, bir şablon ya da kendi metnin.
- **Arkadaşlar ve sohbetler.** İsteğe bağlı GitHub girişi ayarlarını tüm bilgisayarlarında aynı tutar ve sana bir @takma ad verir; arkadaşlarını tam takma adlarıyla ekle, kimin çevrimiçi olduğunu gör, panolarını paylaş, onları oyuna davet et, ikili ya da grup halinde sohbet et.
- **Ajanın ne yaptığını bilir.** Ajan bitirdiğinde ya da izin istediğinde oyunun üstünde bir bildirim çıkar — oynamaya devam et, duraklat ya da doğrudan ajana dön (davranışı ayarlardan seçersin). Claude Desktop’ta izlediğin sekmeyi de kapatabilir, böylece sohbet yeniden önüne gelir.
- **Kendiliğinden belirir.** Ajan 10 saniye çalıştıktan sonra Arcade istemin üstünde bir oyun önerir — ya da ayarlarda seçtiğin gibi daha sonra veya hiç; sen istemedikçe odağı asla almaz.
- **Oturumdan oturuma seninle gelir.** Arcade panelini açık bırak, her yeni Claude Code oturumu onu kendiliğinden açar; elle kapatırsan kapalı kalır.
- **Tek menü, altı bölüm.** *Oyna*, *Oku ve dinle*, *İzle*, *Sosyal*, *İş* ve *Diğer* — ihtiyacın olmayanları daralt. En üstte: son oyuna *Devam et*, *Ara* ve *Favoriler*. Arcade’i ilk açtığında hangi bölümlerin görüneceğini seçersin.
- **61 ücretsiz oyun:** NES (Dendy), Sega Mega Drive, Master System, PlayStation ve arcade oyunları, nişancı, yarış, strateji, macera ve masa oyunları içeren bir *Oyunlar* sekmesi.
- **Oku ve dinle.** 30 dilde klasikler ve LibriVox sesli kitapları, doğrudan Project Gutenberg, Vikikaynak ve LibriVox’tan; ayrıca ajanın üzerinde çalıştığı konuyla ilgili yeni makaleler ve podcast bölümleri.
- **İzle.** Ajanın üzerinde çalıştığı konuyla ilgili yeni YouTube videoları, Twitch: kendi kanalların ile programlama, teknoloji, bilim ve retro oyunlar üzerine canlı yayınlar ve TikTok: girişi kendin yaptığın TikTok’un kendi sitesinde *Sana Özel* akışı ve arama.
- **NES ve Flappy Arcade doğrudan Claude Code içinde** — terminalde, VS Code’da ve Claude Desktop’ta. Geri kalan her şey bir tarayıcı penceresinde açılır; Claude Desktop’ta varsayılan olarak Claude’un yerleşik tarayıcısında (nişancı oyunları yine de tarayıcı penceresinde açılır: yerleşik tarayıcı fareyi yakalayamaz).
- **Çevrim içi oyun.** Ağ üzerinden iki kişilik konsol oyunları, Doom’da deathmatch ve co-op, insanlara ya da bilgisayara karşı satranç, go, dama ve reversi.
- **«Çevrim içi kim bekliyor».** Biri oyun arkadaşı beklediğinde Arcade bunu Claude Code’da bir *Katıl* düğmesiyle gösterir.
- **Arama ve favoriler.** Oyunlarda ve Twitch kanallarında tek bir arama, bölüme ve türe göre gruplanmış; *★ Favoriler*’de tutmak için bir oyunu ☆ ile işaretle.
- **Kendi oyunların.** Sahip olduğun ROM’ları ekle; bilgisayarında kalırlar.
- **13 arayüz dili:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — sistem ya da tarayıcı diline göre, varsayılan İngilizce.

## Kurulum

**Claude Code 2.1.275 veya daha yenisi** gerekir. *Limitler* için limitleri eklentilere bildiren bir Claude Code gerekir (2.1.302 ve 2.1.316’da denendi); daha eski bir sürümde bu ekran bunu söyler, Arcade’in geri kalanı her zamanki gibi çalışır.

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

Ya da marketplace’i de yol üstünde ekleyen tek bir adımla — terminalde ya da bir oturumun içinde:

```
claude plugin install arcade --marketplace ArbakovMaxim/agent-arcade
```

```
/plugin install arcade --marketplace ArbakovMaxim/agent-arcade
```

Eklenti tüm oturumlar ve uygulamalar için kurulur. VS Code eklentisinde `/plugin` komutu yok — terminalden kur, VS Code eklentisi yeni bir sohbette onu algılar.

**Güncelleme:**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

Ardından Claude Code’u yeniden başlat. Marketplace yalnızca eklentiyi indirir — birkaç MiB, site olmadan — bu yüzden güncelleme saniyeler sürer. Arcade zaten kuruluysa bir şey yapmana gerek yok: marketplace bir sonraki güncellemede kendiliğinden geçiş yapar.

`/plugin update` *already at the latest version* diyor ama Arcade’in yeni sürümü çıkmışsa marketplace yenilenmemiştir. Nedenini görmek için terminalde `claude plugin marketplace update agent-arcade` komutunu çalıştır. *timed out* yazıyorsa klonlamaya 10 dakika ver:

```
CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000 claude plugin marketplace update agent-arcade
```

PowerShell’de: `$env:CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000; claude plugin marketplace update agent-arcade`. Ardından `/plugin update arcade@agent-arcade` komutunu yeniden çalıştır.

**Kaldırma:** `/plugin uninstall arcade@agent-arcade`

## Kullanım

- **`/arcade`** menüyü istediğin an açar.
- Paneli açık bırak, yeni oturumlar onu kendiliğinden açar: terminalde başlarken, Desktop’ta ve VS Code’da oturuma bağlandıklarında; klavye istemde kalır. Elle kapatırsan (kapatma işareti ya da Esc), sen yeniden açana kadar kendiliğinden açılmaz.
- Ajan 10 saniyeden uzun çalıştığında istemin üstünde *«oynamak ister misin?»* belirir: **`1`** — burada, panelde oyna; **`2`** — bir tarayıcı penceresinde (olan yerlerde); **`3`** — şimdi değil; ardından ne kadar sorulmayacağını seçersin: 5 ya da 10 dakika, Claude yeniden başlayana kadar (bu bilgisayardaki tüm oturumlarda) ya da yalnızca bu sefer. Ayarlar → Bildirimler’den ne zaman görüneceğini — 10 saniyeden 5 dakikaya kadar — seçebilir ya da kapatabilirsin.
- Seçmek için oklar ya da Tab, açmak için Enter; fare de çalışır. Kontroller her oyunun altında yazılı.
- Ajan bitirdiğinde ya da izin beklediğinde oyunun üstünde bir bildirim çıkar: **Ajana dön** ya da **Oynamaya devam et**.

### Menü

| Bölüm | İçinde ne var |
|---|---|
| *(en üst)* | Son oyuna **▶ Devam et**, **🔍 Ara**, **★ Favoriler** |
| **Oyna** | NES, Sega, Master System, PlayStation, Oyunlar; biri çevrim içi beklerken *Katıl*; **Oyunlarım** |
| **Oku ve dinle** | Kitaplar, Sesli kitaplar, Makaleler, Podcast’ler |
| **İzle** | YouTube, Twitch, TikTok |
| **Sosyal** | Arkadaşlar, Sohbetler, **GitHub ile giriş yap** (giriş yaptıktan sonra **Hesap**) |
| **İş** | Bugün, Defter, Proje panosu, Promptlar, Takvim, Ajanlar, Limitler |
| **Diğer** | Arcade penceresi, Ayarlar, 🌐 dil, 🐞 Hata bildir, ☕ Projeye destek ol |

Bir bölümü daraltmak ya da genişletmek için başlığına tıkla. Daraltılmış bölüm `▸` ve içindeki kutucuk sayısını gösterir; *Sosyal* ayrıca yeni mesajları 💬 ve arkadaşlık isteklerini 👥 gösterir. Arcade hangi bölümlerin daraltıldığını hatırlar. İhtiyacın olmayan bir bölümü **Ayarlar**’dan gizleyebilirsin: başlığı ve kutucuklarıyla birlikte menüden tamamen kalkar; ayarların bulunduğu *Diğer* her zaman kalır. Giriş yaptıktan sonra menü başlığı @takma adını aynı sayaçlarla gösterir.

**Arama** iki harften itibaren başlar ve büyük-küçük harf ile aksanlara bakmadan başlık ya da tür bulur. Sonuçlar bölüme ve türe göre gruplanır, örneğin *Oyunlar · Nişancı*. Bir oyunun yanındaki ☆ yıldızı onu **★ Favoriler**’e ekler (en fazla 100); favoriler bölüme ve türe göre sıralanır, en yeniler önce. Kitapların ve sesli kitapların başlığa ya da yazara göre kendi araması var.

### Ne nerede açılır

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, diğer Oyunlar; kitaplar, sesli kitaplar, makaleler, podcast’ler, videolar |
|---|---|---|
| **Terminal** | panelde (terminal destekliyorsa piksel grafik, değilse metin blokları) | tarayıcı penceresi |
| **VS Code** | panelde | tarayıcı penceresi |
| **Claude Desktop** | panelde | Claude’un yerleşik tarayıcısı ya da tarayıcı penceresi (ayarlardan seçilir); nişancı oyunları — her zaman tarayıcı penceresi |

Tarayıcı penceresi ayrı bir Arcade penceresidir (varsayılan tarayıcında ya da ayarlarda seçtiğin tarayıcıda), sıradan sekmelerinin arasında bir sekme değil. Sohbetler doğrudan panelde çalışır — terminalde ve Desktop’ta; *Sayfada aç* onları sitede aynı şekilde açar. Defter, proje panoları, takvim ve ajanlar panelde çalışır. TikTok, Desktop’ta Claude’un yerleşik tarayıcısında, diğer yerlerde ise büyük ihtimalle zaten giriş yapmış olduğun varsayılan tarayıcında açılır.

## Defter ve proje panoları

İkisi de menünün *İş* bölümünde.

- **Defter.** Sayfalar ve alt sayfalar; `# ` ile başlayan satır başlık, `- ` ile başlayan madde, `- [ ] ` ile başlayan ise basınca işaretlenen bir kontrol listesi maddesidir. Bu bilgisayarda tutulur — en fazla 200 sayfa, sayfa başına 20.000 karakter.
- **Düzenle ve Kopyala.** Sayfa ya da kart, metnini Desktop’ta ve VS Code’da biçimlendirilmiş olarak — başlıklar, listeler, kontrol listesi —, terminalde ise satırlar halinde gösterir. *Düzenle* yerinde metin kutusunu açar: Enter kaydeder, *İptal* değişikliği atar, bu arada Claude’un ya da başka bir oturumun yaptığı değişiklikler kutuda görünür. *Kopyala* sayfanın tamamını kopyalama panosuna alır — Desktop panelinde metin yalnızca giriş kutularında seçilebildiği için sayfa bu şekilde kopyalanır.
- **Claude da tutar.** *Claude’a ver* sayfayı Claude’a iletir; ya da sadece Claude’dan Arcade’e bir şey not etmesini iste. Claude, yalnızca defteri değiştiren ve hiçbir şey silmeyen `mcp__arcade__notes` aracını kullanır. Claude’un düzenlemesini beğenmezsen: *Claude’un düzenlemesinden önceki metni geri getir*.
- **Proje notları.** Bir sayfada ya da pano kartında *Klasör için bağlam: api*, onu bu oturumun çalıştığı klasörün notları yapar — her klasöre bir sayfa; bir sayfa birden çok klasöre hizmet edebilir. O klasördeki her yeni Claude Code oturumu, başlangıçta sayfanın metnini isteminin ayrı bir bölümü olarak alır: “Project notes from the Arcade notebook”. Bölüm oturumun ortasında değişmez: bir düzenleme sonraki oturumdan ya da `/clear` sonrasından itibaren geçerli olur. 8.000 karakterden uzun bir sayfa kısaltılarak girer ve sayfa bunu bildirir. *Ajanlar*, bir oturumun hangi sayfayı aldığını gösterir. Claude, `mcp__arcade__notes` ile proje kararlarını sayfaya ekleyebilir; bölüm ondan yalnızca eklemesini, metni asla değiştirmemesini ister. Sayfayı yalnızca sen işaretlersin, o da yalnızca içinde bulunduğun oturumun klasörü için; işaret yoksa isteme hiçbir şey girmez ve Arcade `CLAUDE.md`’ye asla yazmaz. Ortak bir panodaki işaretli kartı başka biri düzenlerse bağlamda önceki sürüm kalır: sen *Bu sürümü bağlam olarak al*’a basana kadar kartta *@takma ad tarafından değiştirildi* yazar.
- **Notion ve diğer uygulamalar** — Claude’un bağlayıcılarıyla, bu yüzden Arcade’in anahtara ya da parolaya ihtiyacı yok: *Notion’a gönder*, *Başka bir uygulamaya*, *Notion’dan veya başka bir uygulamadan içe aktar*. Bağlı bir sayfa uygulamada güncellenebilir ya da oradan yeniden içe aktarılabilir.
- **Sesle.** Sistemin kendi dikte özelliğiyle Claude’un giriş kutusuna dikte et (Windows’ta Win+H, macOS’ta iki kez Fn), sonra *Claude’un giriş kutusundan al*’a bas — metin sayfanın sonuna taşınır.
- **Proje panosu.** Sütunlar — *Yapılacak*, *Yapılıyor*, *Bitti* ya da kendi sütunların, en fazla 8 — ve kartlar; kart, metin ve kontrol listesi olan bir defter sayfasıdır. Bir kartı seçip oklarla taşımak için ona bas, açmak için bir kez daha bas. Claude da pano yönetebilir: *Claude’a ver* ya da ondan görevleri Arcade’de bir panoya dağıtmasını iste.
- **Ortak panolar.** @takma adla giriş yaptıysan arkadaşlarını işaretle ve *Paylaş*’a bas: herkeste aynı kartlar, sütunlar ve ad olur, değişiklikler birkaç saniye içinde görünür. Sahip başka arkadaşlarını da davet eder, kişileri çıkarır ve panoyu siteden siler; panodan herkes çıkabilir; ne olursa olsun herkesin kendi kopyası kalır. Kendine ait en fazla 3 ortak pano, bir panoda en fazla 20 kişi ve 200 kart.
- **Aynı anda birkaç oturum.** Bu bilgisayarda açık olan tüm Claude Code oturumları tek bir defteri ve panolarını paylaşır: bir oturumun eklediğini, değiştirdiğini ya da işaretlediğini diğerleri birkaç saniye içinde görür; böylece her oturum aynı panonun kendi kartı üzerinde çalışabilir.
- **Claude için kuyruk.** Bir panoda *Claude için kuyruk* ilk sütunun ilk kartını Claude’a verir ve panoda ikiden fazla sütun varsa kartı ikinci sütuna taşır. Claude yanıtını bitirdiğinde o kart son sütundaysa sıradaki kart kendiliğinden gider; bir çalıştırmada en fazla 10 kart. Claude bir soru sorarsa, yanıtı yarıda kesilir ya da hatayla biterse, kart son sütunda değilse veya Claude’a başka bir şey gönderirsen kuyruk durur — bundan sonrasına sen karar verirsin. İzin isteği kuyruğu durdurmaz: izin verildiyse — sen ya da otomatik mod — ve kart son sütundaysa sıradaki gider. *Kuyruğu durdur* Claude’un mevcut kartı bitirmesine izin verir ama ona sıradakini vermez. Ortak panoda başkasının üstlendiği kartlar atlanır. Kuyruk aynı anda birkaç oturumda çalışabilir — bkz. [Ajanlar](#ajanlar). Kuyruğun ortasında Claude’un limiti biterse kuyruk sıfırlamadan sonra devam edebilir — bkz. [Limitler](#limitler).
- **Kartlar arası kontrol.** Bir panonun ekranında *Kartlar arası kontrol* alanına `npm test` gibi bir komut yaz; bir kartın kendi komutu da olabilir: *Kendi kontrolü* alanında. Claude yanıtını bitirdiğinde kart son sütundaysa kuyruk, sıradaki kartı vermeden önce komutu oturumun klasöründe çalıştırır (en fazla 10 dakika). Çıkış kodu 0 ise sıradaki kart gider. Değilse kuyruk durur, kart *Kontrol geçmedi* işaretiyle ikinci sütuna döner ve Claude çıktının sonunu alır; sorunu düzeltip kartı yeniden taşır. Kuyruğu yeniden başlattığında Arcade önce o kartı kontrol eder. Sonuç panoda ve *Günün özeti* bölümünde görünür. Kuyruk birkaç oturumda çalışıyorsa kontrolü kartı yapan oturum çalıştırır. Komut, bir Claude Code hook'u gibi izin sorulmadan çalışır ve yalnızca bu bilgisayarda saklanır — defterde ya da ortak bir panoda değil —; ne Claude ne de pano üyeleri onu değiştirebilir. Komut yoksa kuyruk eskisi gibi çalışır.
- **Kart incelemesi.** Claude, kendisine verilen bir kartı — *Claude'a ver* ile ya da kuyruktan — son sütuna taşıdığında Arcade, kart verildiğinden beri oturumun git klasöründe neyin değiştiğini kaydeder ve pano kartın altında *dosya: 4 · +120 −15* gösterir. Ona basınca kartın *İnceleme* ekranı açılır: eklenen ve silinen satırlarıyla dosyalar, her dosyanın diff’i (uzun olanı kısaltılır) ve commit’ler. *Kabul et* kartı yalnızca *✓ kabul edildi* olarak işaretler — Arcade hiçbir şeyi commit’lemez ve push’lamaz. *Yorumla geri gönder* kartı *↩ geri gönderildi* işaretiyle ikinci sütuna geri taşır ve yorumunu karta ekler; Claude onu *Kontrol geçmedi* durumundaki gibi alır — çalışan bir kuyrukta ilk sırada, Claude bu oturumda boştaysa hemen, değilse yanıtını bitirdiğinde. Aynı klasörde başka bir oturum çalıştıysa inceleme, değişikliklerin kime ait olduğunun ayırt edilemediğini söyler. Dosyalar ve diff’ler bu bilgisayarda kalır: ortak bir panoda diğerleri yalnızca ✓ ya da ↩ ve yorumu görür. *Günün özeti* kabul edilen ve geri gönderilen kartları sayar.
- **Son tarihler.** Kartın *Son tarih* alanı «fri», «tomorrow», «20.11» ya da «2026-11-20» kabul eder. Tarih panoda kartın altında görünür — geçmişse ve kart bitmemişse uyarı renginde — ve takvimde de yer alır; kart o gün hâlâ son sütunda değilse takvim 9:00’da hatırlatır. Claude da son tarih koyar.
- **Kartı kim üstlendi.** Ortak panoda *Claude’a ver* kartı senin olarak işaretler ve herkes kartın altında «üstlenen: @kullanıcı» görür. Kartı başkası üstlendiyse Arcade önce bunu söyler; yine de kendi Claude’una vermek için bir kez daha bas. *Kartı bırak* kartı serbest bırakır.
- **Takip aracından issue’lar.** Panoda takip aracını seç — GitHub, Linear, Jira ya da *Başka takip aracı* — ve issue’ların nereden alınacağını yaz: `owner/repo`, bir ekip ya da proje anahtarı veya bir bağlantı. Claude, o takip aracının bağlayıcısıyla en fazla 20 açık issue okur ve panoda henüz olmayanları kart olarak ekler. Böyle bir kartta takip aracının adıyla birlikte *Sonucu gönder:* düğmesine basınca Claude, issue’ya ne yapıldığını anlatan kısa bir yorum yazar; issue’yu kapatmaz, durumunu da değiştirmez. Arcade’in kendisi takip araçlarıyla hiç konuşmaz ve anahtar saklamaz: her şey Claude’a eklediğin bağlayıcılar üzerinden gider — GitHub, Linear, Jira için Atlassian, Asana, ClickUp, monday.com ve diğerleri. Bağlayıcı yoksa Claude bunu söyler ve nereden ekleneceğini anlatır.
- **Günün özeti.** Panoların altındaki ve defterdeki düğme «Özet GG.AA» adlı bir sayfa hazırlar: bugün Claude’a ne gitti, ne bitti — son sütuna taşınan kartlar, işaretlenen maddeler — ve ne hâlâ sürüyor. Onu Claude’a verebilir, düzenleyebilir ya da bir sohbete gönderebilirsin.
- **Sohbete gönder.** Giriş yaptıysan *Sohbete gönder* herhangi bir sayfayı son sohbetlerinden birine metin olarak, başlıkları ve kontrol listesi işaretleri korunarak gönderir.

## Promptlar

Menünün *İş* bölümünde bir kutucuk: her biri tek basışla Claude’a giden kendi prompt şablonların.

- **Şablonlar.** Şablon, düğmedeki bir ad ve Claude’a gidecek metindir. *Yeni şablon*’a bir ad yaz, sonra metni; Enter kaydeder. Şablonlar setlerde durur: ilki *Promptlarım*’a gider, *Yeni set* bir set daha açar. Şablon yeniden adlandırılabilir, düzenlenebilir, *↑ Yukarı* ve *↓ Aşağı* ile taşınabilir ve ikinci basışla silinebilir.
- **Tek basış.** Bir şablona basmak, metnini olduğu gibi Claude’a gönderir, *Claude'a ver* gibi: Claude boştaysa hemen; meşgulse şablon, sen gönderene kadar giriş kutusunda bekler. *Giriş kutusuna* onu orada yazdıklarının sonuna ekler, göndermez; böylece tamamlayabilirsin. Her şablonun altında metninin ilk satırı görünür; ✎ onu düzenlemek için açar.
- **Claude da kaydeder.** «bunu Arcade’de prompt olarak kaydet» de, Claude `mcp__arcade__notes` aracıyla bir şablon ekler.
- **Ortak setler.** @takma adla giriş yaptıysan *Set ayarları*’nı aç, arkadaşlarını işaretle ve *Paylaş*’a bas: herkeste aynı şablonlar ve ad olur, değişiklikler birkaç saniye içinde görünür. Arkadaşlarının ortak setleri senin *Promptlar* kutucuğunda kendiliğinden görünür. [Ortak panolarda](#defter-ve-proje-panoları) olduğu gibi sahip kişileri davet eder ve çıkarır, setten herkes çıkabilir ve herkesin kendi kopyası kalır. Ortak setler, kendine ait 3 ortak pano sınırına dahildir.
- **Komut değil.** Şablonlar Arcade panelindeki düğmelerdir, Claude Code komutları değil: eğik çizgi komutları ve skill’ler eskisi gibi çalışır. Şablonlar defterle birlikte bu bilgisayarda tutulur ve defterin 200 sayfasına dahildir.

## Takvim

Menünün *İş* bölümündedir. Defter gibi takvim de bu bilgisayarda, Claude Code’un eklenti deposunda tutulur ve açık tüm oturumlar onu paylaşır.

- **Ay ve gün.** Desktop’ta oklar ve *Bugün* düğmesiyle, aynı boyda gün kutucuklarından oluşan bir ay ızgarası: üstte tarih, altında her etkinliğin renginde bir nokta (üçe kadar, sonra «+N»). Seçili günün çerçevesi vurgulu, bugünün arka planı renklidir. Izgaranın altında seçili günün etkinlikleri, ardından önümüzdeki 30 gün için *Yaklaşanlar* durur, her etkinliğin renginde kartlar olarak. Terminalde ve VS Code’da *Yaklaşanlar* listesidir.
- **Tek satır bir etkinlik ekler:** «fri 9:30 standup», «tomorrow 15:00 call», «12.11 review», «2026-11-20 10:00 demo». Gün yoksa ızgarada seçili gün (terminalde bugün), saat yoksa tüm gün. Gün sözcükleri İngilizce ve Rusça anlaşılır.
- **Tekrar.** Tekrarlanmıyor, her gün, hafta içi, her hafta, her ay ya da her yıl; etkinliğin günü, serinin başladığı gündür. Tek satırla da yazılabilir: «every friday 10:00 retro», «on weekdays 9:30 standup».
- **Renk.** Mavi, yeşil, sarı, turuncu, kırmızı, mor, pembe ya da gri; varsayılan mavi.
- **Hatırlatma.** Listeden seç: başlangıçta, 5, 10, 15 ya da 30 dakika, 1 ya da 2 saat, bir gün, iki gün ya da bir hafta önce; tüm gün süren bir etkinlikte o gün 9:00, 8:00 ya da 7:00’de, bir gün önce 21:00, 18:00 ya da 9:00’da, iki gün ya da bir hafta önce 9:00’da. Ya da kendi zamanını İngilizce veya Rusça yaz: «45 min before», «at 14:30», «the day before at 20:00» — başlangıçtan geç ve bir haftadan erken olamaz. Listesi olmayan telefondaki Claude uygulamasında bir düğme seçenekler arasında sırayla geçer.
- **Bildirimler.** Hatırlatma, açık bir Claude Code oturumu olduğu sürece sistem bildirimi ve kısa bir uyarı olarak gelir; onu tüm oturumlar değil, bir oturum gösterir. Claude Code kapalıyken kaçırılan hatırlatma, etkinliğin üzerinden bir günden az geçtiyse bir sonraki açılışta *Kaçırıldı* olarak görünür.
- **Claude da tutar**, yalnızca takvimi değiştiren `mcp__arcade__calendar` aracıyla: «cuma 15:00’e bir görüşme ekle», «yarın neyim var?», «demoyu kırmızı yap».
- **Kart son tarihleri.** Son tarihi olan pano kartları kendi günlerinde tüm gün süren kayıtlar olarak görünür, kart son sütuna geçince *bitti* olarak; onları kartın üzerinden değiştirirsin.
- **Zamanlama: Claude için bir görev.** Bir etkinlikte *Claude’a ver*, etkinliğin saatinde Claude’un ne alacağını seçer: bir panonun kuyruğu, tek bir kart, [Promptlar](#promptlar)’dan bir şablon ya da kendi metnin; tüm gün süren bir etkinlikte 9:00’da. Tekrarlar her zamanki gibi çalışır. Bunu Claude da ayarlayabilir: «hafta içi her gün 9:00’da Sürüm panosunun kuyruğunu Claude’a ver».
- **Nerede çalışır.** Etkinlik, ayarlandığı klasörü hatırlar; görev o klasörde çalışan bir Claude Code oturumuna gider, yalnızca birine. Claude meşgulse görev, Claude yanıtını bitirene kadar bekler. *Bu klasörde çalıştır* görevi mevcut oturumun klasörüne taşır.
- **Kaçırılan görevler.** O klasörde çalışan bir oturum yoktuysa — Claude Code kapalıydı, bilgisayar uykudaydı ya da Desktop yeniden başlatıldıktan sonra o oturum henüz açılmamıştı — görev kendiliğinden geç çalışmaz ve hiçbir zaman başka bir klasörün oturumuna gitmez. Çalışan herhangi bir Arcade oturumu bunu bir sistem bildirimiyle söyler: yalnızca biri, hepsi değil. O klasörün oturumu başladığında kısa bir uyarı çıkar, takvimin üstünde de *Şimdi çalıştır* ve *Çalıştırma* ile birlikte *Kaçırıldı* görünür. Bir günden uzun süre önce kaçırılan görev sessizce atlanır.
- **Neyi vaat etmez.** Yalnızca Claude Code açıkken ve bilgisayar uykuda değilken çalışır; Arcade bilgisayarı uyandırmaz ve Claude Code’u başlatmaz. Desktop yeniden başlatıldıktan sonra oturumlar, sen içlerine girene kadar bekler — görevin klasöründeki oturuma gir. Görev, oturumun mevcut izin modunda çalışır ve Arcade yeni haklar vermez: Auto dışında Claude senin iznini bekleyebilir.
- **Diğer zamanlayıcıların yanında.** Claude Code’un kendi zamanlayıcıları var: `/loop` bir promptu mevcut oturumda tekrarlar, Desktop’taki zamanlanmış görevler bir oturumu zamanlayıcıyla başlatır, buluttaki zamanlanmış görevler ise bilgisayarın kapalıyken bile çalışır. Arcade’in zamanlaması panoların ve takvimin üzerine kuruludur: görevler ay ızgarasında etkinliklerinin yanında durur, projenin klasöründe zaten çalışan bir oturuma gider ve terminalde, VS Code’da ve Desktop’ta aynı şekilde çalışır.
- Google ya da Apple takvimleriyle henüz eşitlenmez.

## Ajanlar

Menünün *İş* bölümündedir: bu bilgisayarda Arcade açık Claude Code oturumları, her biri klasörünün adıyla; seninki *bu oturum* olarak işaretli.

- **Her biri ne yapıyor.** *İzin bekliyor*, *yanıt bekliyor*, *yanıtını bitirdi*, *çalışıyor*, *arka planda çalışıyor · ajan sayısı: 2* ya da *boşta* ve ne kadar süredir; üzerinde çalıştığı kart ve kuyruktaki yeriyle, örneğin *Kuyruk: kart 3 / 10*. *Arka planda çalışıyor*, Claude’un yanıtı bitti ama başlattığı alt ajanların hâlâ çalıştığı anlamına gelir: *yanıtını bitirdi*, onun bildirimi ve kuyruğun sıradaki kartı, alt ajanlar bitene kadar bekler. İzin bekleyen oturumlar en üstte. Desktop’ta her oturum bir kart, terminalde ve VS Code’da bir satırdır. Kapanan oturum bir dakikadan kısa sürede kaybolur.
- **Klasöründen bul.** Arcade başka bir oturumu senin yerine açamaz; klasörün adı onun hangi pencere ya da sekme olduğunu söyler.
- **Buradan yanıtla.** Başka bir oturumdaki Claude seçenekli bir soru sorduğunda, o oturumun kartı soruyu ve seçenekleri düğme olarak gösterir. Tek bir soru ilk basışta gider; birkaç soru varsa seçenekleri seç ve *Yanıtla*’ya bas. Bir saniye içinde o oturumdaki Claude yanıtı, orada verilmiş gibi alır. İzin isteği de görünür — araç ve komutla, örneğin *Bash: npm test* — ama izin yalnızca o oturumun kendisinde verilir.
- **Tek kuyruk, birkaç oturum.** Her oturumda aynı panoda *Claude için kuyruk*’a bas; sıradaki kartı hangisi boştaysa o alır, iki oturum aynı kartı almaz. Katılan oturum bunu söyler: *Bu panoda kuyruk zaten “api” oturumunda çalışıyor*. Her oturum kendi kuyruğunu aynı kurallarla durdurur — Claude’un bir sorusu, yarım kalan bir kart, yarıda kesilen bir yanıt, başka bir istek — ve bir çalıştırmada en fazla 10 kart verir. *Kuyruğu durdur* yalnızca bu oturumu durdurur; *Her yerde durdur* hepsini durdurur ve her biri mevcut kartını bitirir. Panoda kartın altında kartın kimde olduğu görünür: *“api” oturumunda*.
- **Aynı klasör.** Kuyruktaki bir oturum aynı klasörde çalışıyorsa Arcade, iki oturumun aynı dosyaları düzenleyebileceği konusunda uyarır ve oturum ancak *Claude için kuyruk*’a bir kez daha bastığında katılır. Ayrı bir klasör ya da git worktree daha güvenli.
- **Ne değişti.** Git klasöründe bir oturumun kartında *dal landing · değişen dosya: 4 · commit edilmedi* gibi bir satır, varsa *gönderilmemiş commit: 2* de olur; ona basınca dosyalar eklenen ve silinen satır sayılarıyla açılır. İki oturum aynı dosyayı değiştirirse iki kart da bunu söyler — *app.js dosyasını “api” oturumu da düzenliyor*; aynı klasördeki oturumların değişiklikleri ortaktır ve Arcade kimin olduğunun ayırt edilemeyeceğini belirtir. Kendi kartında *Claude'a ver: değişiklikleri incele* vardır: Claude commit edilmemiş değişikliklere bakar ve neyin düzeltilmeye değer olduğunu söyler; hiçbir şeyi commit etmez, geri almaz, stash'e koymaz. Diğer oturumların değişiklikleri yalnızca gösterilir. Her oturum git'i kendi klasöründe, başlarken ve her yanıtın sonunda okur — yalnızca okuma, zamanlayıcı ve ağ olmadan.
- **Claude ne yanıtladı.** Bir oturum yanıtını bitirdiğinde kartında Claude'un son yanıtının başı görünür — Markdown'sız bir iki satır, örneğin *Girişi düzelttim: token artık kendini yeniliyor.* — yanında *bitirdi: 14:05* ve git klasöründe *bu yanıtta değişen dosya: 2* (yanıt sırasında değişen, commit edilmemiş dosyalar). Bunlar yanıtın kendi ilk sözleridir, yaklaşık 160 karaktere kısaltılır: bunun için hiçbir model çağrılmaz. Oturum yeniden çalışmaya başlayınca bu satır, yanıt bitene kadar kaybolur.
- **Uyarılar ve bildirimler.** Başka bir oturum izin istediğinde ya da soru sorduğunda kendi Arcade panelindeki kısa bir uyarı *“api” oturumu izin bekliyor* ya da *…bir sorunun yanıtını bekliyor* der. Sesli bir sistem bildirimi aynısını herhangi bir oturum için söyler, Claude Code simge durumundayken ya da önde başka bir uygulama varken bile: aynı anda birkaç oturum için tek bildirim, örneğin *Seni bekliyor: api, web*, en fazla 30 saniyede bir ve bu bilgisayardaki her oturumdan değil, tek bir oturumdan. Biten yanıtın kendi sesi vardır ve uyarısı gibi varsayılan olarak kapalıdır. Windows’ta bu, tüm pencerelerin üstünde bir karttır; tıklayınca Claude Code öne gelir ve *Ajanlar* açılır. Claude Code öndeyken kart, en son yazdığın ya da Arcade panelini kullandığın oturumu atlar. macOS ve Linux hangi pencerenin önde olduğunu söylemez, bu yüzden orada tüm oturumlar adıyla geçer. *Ayarlar → Bildirimler*’de her birini kapatabilir ya da biten yanıtı açabilirsin.
- **Birini gizle.** Başka bir oturumun yanındaki ×, onu uyarıları ve bildirimleriyle birlikte gizler; alttaki *Gizli oturumlar*dan geri getirene kadar görünmez. İzin ya da yanıt bekleyen gizli bir oturum bunu orada söyler. Gizli oturumlar tüm oturumlarda hatırlanır.
- **Bu bilgisayarda kalır.** Her oturum `~/.claude/arcade/agents` içinde klasörünü, durumunu, kartını, beklediği soruyu ya da izin isteğini ve [Limitler](#limitler) için bağlamını, maliyetini ve limit pencerelerini tutan küçük bir dosya saklar; *Ajanlar*’dan gönderilen yanıt, oturuma bunların yanında küçük bir dosya olarak gider. Git klasöründe dalı ve değişen dosyaların adlarını satır sayılarıyla da tutar. Yanıt bittiğinde oraya Claude'un yanıtının başı ve saat de yazılır. Arcade sitesine hiçbir şey gitmez.

## Limitler

Menünün *İş* bölümündedir. Rakamlar Claude Code’un kendisinden gelir, durum satırının gösterdikleriyle aynıdır: Arcade kendi başına bir şey saymaz.

- **Limit pencereleri.** 5 saat, hafta ve harcama limiti — yüzde, çubuk ve sıfırlanma saati: «sıfırlanma: 14:30 (1 sa 20 dk sonra)». Çubuk mavidir, %80’den itibaren sarı, limit bitince kırmızı olur. Pencereler hesaba aittir ve tüm oturumlarınca paylaşılır; bu yüzden ekran bu bilgisayardaki tüm oturumlardan gelen en taze ölçümü ve kaç dakika önce yapıldığını gösterir.
- **Ne zaman biter.** 5 saatlik ve haftalık pencerelerin altında bir satır, pencerenin şu anki hızla ne zaman biteceğini söyler: *Yaklaşık: bu hızla 14:40 civarında biter* ya da *Yaklaşık: bu hızla sıfırlamaya kadar yeter*. Hız, pencerenin yüzdesinin ölçümlerin son bir saatinde nasıl arttığından çıkar; ölçümler 10 dakikadan kısa bir süreyi kapsıyorsa ya da yüzde yarım saatten kısa sürede %2’den az arttıysa, rastgele bir saat yerine satır hiç çıkmaz. Yarım saatten az kaldıysa satır sarıdır. Bu, Claude Code’un kendi yüzdelerinden yapılan bir tahmindir: Arcade token saymaz.
- **Pencere olmadığında.** Claude’un ilk yanıtından önce ekran bunu söyler: *Claude’un ilk yanıtından sonra görünür.* API anahtarıyla ya da bir ağ geçidi üzerinden hiç pencere yoktur — yalnızca bağlam ve maliyet: 5 saatlik ve haftalık pencereler Claude aboneliklerinde vardır (Pro, Max, Team, Enterprise).
- **Bu oturum ve diğerleri.** Bağlamın ne kadar dolu olduğu — yüzde ve token olarak — ve oturum başından beri maliyet; altta, bu bilgisayardaki diğer oturumların bağlamı ve maliyeti. Aynı rakamlar, [Ajanlar](#ajanlar) bölümündeki kartlarında da görünür.
- **Sıfırlamadan sonra kuyruk.** Claude’un yanıtı bir [pano kuyruğunun](#defter-ve-proje-panoları) ortasında kesilirse ve Claude Code bir pencereyi %100’de gösteriyorsa, kuyruk durur ve limitin ne zaman sıfırlanacağını yazar. *Sıfırlamadan sonra kuyruğa devam et (14:31)* düğmesi kuyruğu sıfırlamadan bir dakika sonra aynı karttan sürdürür; beklerken — *“Sürüm” kuyruğu şu saatte devam edecek: 14:31* ve *Devam etme*. Bir panoyu önceden işaretleyebilirsin; o zaman kuyruğu düğmesiz, kendiliğinden devam eder. Bu tahmine göre bir pencere yarım saat içinde bitecekse *Claude için kuyruk* önce sorar: *Limit büyük olasılıkla 14:40 civarında bitecek. Yine de başlatılsın mı?* — *Başlat* ve *İptal* ile; önceden işaretlenmiş bir panoda *Sıfırlamadan sonra kuyruk kendiliğinden devam edecek.* de eklenir.
- **Yalnızca Claude Code açıkken.** Kuyruğa yalnızca açık bir oturum, bilgisayar uykuda değilken devam edebilir. Claude Code kapalıydıysa ya da bilgisayar uykudaydıysa *Limitler* bunu söyler: *“Sürüm” kuyruğu limit sıfırlandıktan sonra devam etmedi: Claude Code kapalıydı ya da bilgisayar uykudaydı*; bekleyen oturum kapatıldıysa — *…limit sıfırlandıktan sonra başlamadı: oturum kapalıydı*. × bu notu kaldırır.
- **%80 ve %90’da uyarı.** Bir pencere %80’e, sonra %90’a ulaştığında Arcade panelinde kısa bir uyarı çıkar — her eşik için tüm oturumlarda bir kez. *Ayarlar → Bildirimler*’de kapatılır. Aynı anahtar bir uyarıyı daha kapsar, her pencere için bir kez: şu anki hızla bir pencere 20 dakikadan kısa sürede bitecekse.
- **Hangi Claude Code.** Her Claude Code sürümü limitleri eklentilere bildirmez — 2.1.302 ve 2.1.316’da denendi. Seninki bildirmiyorsa ekran bunu söyler, Arcade’in geri kalanı her zamanki gibi çalışır.

## Bugün

Menünün *İş* bölümündeki ilk kutucuk: tüm Arcade’den seni bekleyenler, tek ekranda. Kendine ait bir şey saklamaz: hepsi Arcade’in zaten bildiklerinden gelir.

- **Seni bekleyenler.** Bu bilgisayarda izin ya da yanıt bekleyen oturumlar, en uzun bekleyen en üstte, [Ajanlar](#ajanlar)’daki gibi. Seçenekli bir soru burada hemen bir düğmeyle yanıtlanır; izin yalnızca oturumun kendisinde verilir.
- **Sen yokken.** *Bugün* ya da *Ajanlar* en son açıldığından beri yanıtını bitiren oturumlar, en yenisi üstte: *bitirdi: 14:05 · 12 dk önce*, Claude'un yanıtının başı ve kaç dosyanın değiştiği. Burada, *Ajanlar* içinde ya da bu bilgisayardaki başka bir oturumda gördüğün bir daha çıkmaz; gizlenen oturumlar ve yanıt bittikten sonra mesaj yazdığın ya da Arcade panelinde bir şeye bastığın oturumlar da çıkmaz.
- **Takvimde.** Bugünün etkinlikleri; geçmiş olanlar daha soluk. Birine basınca [takvimde](#takvim) açılır.
- **Son tarih.** Son tarihi bugün olan ya da geçmiş, henüz son sütunda olmayan pano kartları, panonun adıyla; birine basınca kart açılır.
- **Kartlarım.** Ortak panolarda üstlendiğin ve henüz bitmemiş kartlar.
- **Sohbetler.** Giriş yaptıysan okunmamış sohbetler; birine basınca sohbet açılır.
- **Limitler.** [Limitler](#limitler)’den tek satır, örneğin *5 saat: 62%, sıfırlanma: 14:30*; %80’den itibaren sarı.

Boş bloklar gizlenir; bekleyen bir şey yoksa ekran *Bugünlük bu kadar.* der. Desktop’ta oturumlar kart, terminalde ve VS Code’da her şey satırdır.

## Ekipler için

Küçük bir ekip görevlerini Arcade’de tutabilir: tek bir ortak pano, kartı alan da onu kendi Claude’una verir.

1. Herkes Arcade’i kurar (Claude Code 2.1.275 veya daha yenisi) — bkz. [Kurulum](#kurulum).
2. `/arcade` → **Sosyal** → **GitHub ile giriş yap**: GitHub’ın sayfası tarayıcında açılır; orada onayla, sonra Arcade sayfasında *Sign in*’e tıkla (sayfadaki kod paneldekiyle aynı olmalı). Olmazsa *Kodla giriş yap*.
3. Bir @takma ad al — tek tıkla GitHub adını ya da kendi uydurduğunu.
4. Birbirinizi tam @takma adla arkadaş olarak ekleyin; karşı taraf kabul eder.
5. **İş** → bir pano oluştur → ekip arkadaşlarını işaretle → **Paylaş**.
6. Yalnızca panolar ve sohbetler için mi buradasın? Arcade’i ilk açtığında sadece **İş** ve **Sosyal**’i bırak. Sonra **Ayarlar → Bildirimler**’de **“Oynamak ister misin?” satırı**’na *kapalı* yazana kadar bas: ajan çalışırken istemin üstünde hiçbir şey belirmez.

Bundan sonra: panoyu aç, bir kart seç, **Claude’a ver**. Claude boştaysa kart ona hemen gider; meşgulse sen gönderene kadar giriş kutusunda bekler. Claude yapılanları işaretler ve sonucu karta yazar, panodaki herkes bunu — ve kimin hangi kartı üstlendiğini — birkaç saniye içinde görür. Her karta bir son tarih ver, takviminde görünsün. Gün sonunda *Günün özeti* → *Sohbete gönder* stand-up’ını ekip sohbetine gönderir. Sohbetler **Sosyal**’de.

Birkaç Claude Code oturumunu kendin mi yürütüyorsun? Her birinde aynı panoda *Claude için kuyruk*’a bas: boştaki oturum sıradaki kartı alır, **İş** → **Ajanlar** da her oturumun ne yaptığını gösterir.

Bilmekte fayda var: ortak panolar ve sohbetler Arcade sitesinde saklanır ve şifrelenmez, bu yüzden oraya parola ya da anahtar koyma. Arcade yalnızca GitHub profilinin adını ve resmini öğrenir. Kendine ait en fazla 3 ortak pano, bir panoda en fazla 20 kişi ve 200 kart. *Hesabı sil* (iki kez bas) sitenin seni ve ayarlarını unutmasını sağlar.

## Hesap, arkadaşlar ve sohbetler

Giriş yapmak isteğe bağlı — giriş yapmadan da her şey eskisi gibi çalışır.

- **GitHub ile giriş yap** (*Sosyal* içinde): GitHub’ın giriş sayfası her zamanki tarayıcında açılır; orada onayla, sonra Arcade sayfasında *Sign in*’e tıkla — sayfadaki kod paneldekiyle aynı olmalı. Tarayıcı üzerinden olmazsa *Kodla giriş yap*: Arcade bir kod gösterir, sen de onu GitHub sayfasına girersin. Arcade yalnızca GitHub profilinin adını ve resmini öğrenir — e-posta yok, depolara erişim yok.
- **Eşitleme.** Dil, tuşlar, bildirimler, panel boyutu, ajan haber verdiğinde oyunla ne yapılacağı, Desktop’taki tarayıcı seçenekleri, konuların, Twitch kanalların, favorilerin, daraltılmış ve gizlenmiş bölümler ve Flappy Arcade rekorun tüm bilgisayarlarında aynı olur. Kendi oyunların, tarayıcı ve grafik modu her bilgisayarda ayrı kalır.
- **@takma ad.** GitHub adını tek tıkla al ya da kendin uydur: 4 ila 32 karakter — Latin harfleri, rakamlar ve `_`. Günde en fazla 5 kez değiştirebilirsin.
- **Arkadaşlar.** Bir arkadaşını tam @takma adıyla ekle: istek karşı tarafta kabul edilir ve birbirinizin listesinde görünürsünüz. Yazarken öneri çıkmaz, bu yüzden kimse Arcade’i kimlerin kullandığına göz atamaz. Reddetmek ve silmek sessizce olur.
- **Çevrimiçi durum ve oyun davetleri.** Arcade menüsü açıkken arkadaşların seni *çevrimiçi* görür, sen de onları; görünmek istemiyorsan *Arkadaşlar* ekranında *Arkadaşlarıma çevrimiçi olduğumu göster* ayarını kapat. Bir arkadaşın yanındaki *Davet et* ağ oyunlarını sunar: bir masa oyunu ikiniz için ayrı bir oda, bir Doom oyunu kendi lobisini açar. Oyun sende hemen açılır; arkadaşına bir bildirim ve menünün üstünde *Kabul et* gelir, davet 10 dakika geçerlidir. Ağ oyunlarının tarayıcıda açıldığı yerlerden davet edebilirsin: Desktop’taki yerleşik tarayıcı ya da bir tarayıcı penceresi.
- **Sohbetler.** Bir arkadaşınla ikili, arkadaş grupları ya da tek tıkla tüm arkadaşlarınla bir grup. Doğrudan Arcade panelinde yaz ya da sitedeki sohbet sayfasını aç. Kendi mesajını yanındaki ⋮ menüsünden düzenleyebilir ya da silebilirsin; sitede aynı menü sağ tıkla da açılır. Mesajlar Arcade sitesinde saklanır ve şifrelenmez — oraya parola ya da anahtar yazma.
- **Avatarlar ve mesaj bildirimleri.** *Hesap* bölümünde 24 hazır avatardan birini seç — sohbetler onu yalnızca gösterir; avatar yoksa @takma adının ilk harfi görünür. Bir grubun resmini sahibi aynı 24 resim arasından seçer. GitHub resmin başkalarına asla gösterilmez. Bir arkadaşın yazdığında sol altta tüm pencerelerin üstünde bir kart açılır (Windows) ya da bir sistem bildirimi gelir (macOS, Linux); karta tıklamak o sohbeti açar.
- **Çıkış yap** bu bilgisayarda eşitlemeyi durdurur; **Hesabı sil** (iki kez bas) sitenin seni ve ayarlarını unutmasını sağlar.

## Katalog

| Sekme | İçinde ne var |
|---|---|
| **NES (Dendy)** | 28 homebrew oyun — platform, bulmaca, nişancı, yarış: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical ve diğerleri |
| **Sega** | 11 Mega Drive oyunu: Miniplanets, Tank Battle, Battle 4Tris, Pong ve diğerleri |
| **Master System** | 4 oyun: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Oyunlar → Arcade oyunları** | Flappy Arcade — Arcade’in kendi tek tuşlu oyunu: doğrudan panelde ve Arcade penceresinde çalışır; günün parkuru herkes için aynıdır, rekorun kaydedilir |
| **Oyunlar → Nişancı** | Freedoom Phase 1 ve 2 (Doom’un özgür alternatifleri), FreeDM deathmatch, Blasphemer (Heretic’in özgür alternatifi), BlasphDM deathmatch, OpenArena — Quake III motoruyla botlara karşı arena nişancı oyunu (GPL-2.0) |
| **Oyunlar → Yarış** | HexGL — fütüristik yerçekimsiz yarış |
| **Oyunlar → Strateji** | OpenTTD — ulaşım imparatorluğu (GPL-2.0); Micropolis — 1989’un klasik şehir kurma oyununun açık kaynak kodu, şehrin tarayıcıda kaydedilir (micropolisJS, ek koşullarla GPL-3.0 ve Micropolis Public Name License); Warzone 2100 — kampanyası ve bilgisayara karşı çatışması olan gerçek zamanlı strateji, birliklerini kendin tasarlarsın, kayıtlar tarayıcıda kalır (GPL-2.0-or-later) |
| **Oyunlar → Macera** | ScummVM’de (GPL-3.0-or-later) 90’ların dört ücretsiz klasik macera oyunu: Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress ve Nippon Safes, Inc. — izinle dağıtılabilen freeware oyun verileri; F5 ile istediğin an kaydet |
| **Oyunlar → Masa oyunları** | Satranç — insanlara ya da bilgisayara karşı (Stockfish, 1–10 seviye), çevrim içi saatli; 9×9, 13×13 ve 19×19 tahtalarda go; Rus daması, reversi; hepsinde *Terk et* |
| **Kitaplar** | 30 dilde kamu malı klasikler — dili sen seçersin (başta arayüzün dili). Bölümler her dilde aynı: Popüler, Kurmaca, Şiir, Tiyatro, Macera, Polisiye ve diğerleri; başlığa ya da yazara göre arama yapılır. Liste istek üzerine Project Gutenberg ve Vikikaynak’tan gelir — Arcade’in kendi kitabı yoktur; açtığın kitap tarayıcındaki *Kitaplarım* bölümünde kalır. Ayraç kendiliğinden konur: kitabı yeniden aç, kaldığın yerden devam edersin. Kendi EPUB, FB2 ve TXT dosyaların da Arcade penceresinde açılır |
| **Sesli kitaplar** | Aynı dillerde ve bölümlerde LibriVox kayıtları, aramayla birlikte: doğrudan archive.org’dan çevrim içi dinle ya da çevrim dışı dinlemek için kitabı tarayıcına indir. Arcade penceresindeki oynatıcı kaldığın bölümü, yeri ve hızı hatırlar; kendi MP3, M4A, M4B, OGG ve Opus dosyaların da orada açılır ve tarayıcında kalır |
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

## Kendi oyunların

- **`/arcade-add <dosya>`** bir NES, Mega Drive ya da Master System ROM’u ekler (en fazla 4 MB). Eklenti bir kopyasını `~/.claude/arcade` içinde tutar ve hiçbir yere yüklemez.
- **PlayStation diskleri ve Doom WAD’ları** (örneğin kendi `doom.wad` dosyan) — Arcade penceresinde: **Kendi dosyanı aç**. Yalnızca o tarayıcıda kalırlar.

Yalnızca hakkına sahip olduğun dosyaları ekle.

## Ayarlar

`/arcade` menüsünün *Diğer* bölümünden **Ayarlar**’ı aç:

- **Ana menü bölümleri** — *Diğer* dışındaki her bölümü göster ya da gizle; gizlenen bölüm, buradan geri getirene kadar menüde hiç görünmez. Aynı seçim Arcade ilk açıldığında da sunulur.
- **Dil** — 13 dilden biri (menüde doğrudan da: 🌐).
- **Oyunları aç** — burada panelde, bir tarayıcı penceresinde ya da belirli bir tarayıcıda; Claude Desktop’ta — Claude’un yerleşik tarayıcısında ya da bir tarayıcı penceresinde.
- **Grafik** (terminal) — resim gösterebilen terminallerde (kitty, Ghostty, Rio) piksel, diğer her yerde metin blokları.
- **Panel boyutu** — normal ya da tam genişlik.
- **Ajan bitirdiğinde** — bildirim ve oynamaya devam, bildirimle duraklatma ya da doğrudan ajana dönüş.
- **Ajan izin istediğinde** — aynı üç seçenek.
- **Tarayıcı açılınca** (Claude Desktop) — tarayıcı tüm yüksekliği kullansın diye Arcade menüsünü kapat ya da menüyü onun üstünde bırak.
- **İzlerken ajan bitirdi** (Claude Desktop) — Arcade’in bir video, yayın, TikTok, makale ya da bölüm için açtığı sekmeyi kapat, böylece Claude ile sohbet yeniden önüne gelir; ya da sadece haber ver.
- **Pencerede oynarken bildirimler.**
- **Mesaj bildirimleri** — bir arkadaşın sohbete yazdığında sol altta bir kart (macOS ve Linux’ta sistem bildirimi).
- **Bir oturum izin veya yanıt bekliyor** ve **Bir oturumda Claude yanıtını bitirdi** — bu bilgisayardaki diğer oturumlar hakkında Arcade panelinde kısa bir uyarı ve herhangi bir oturum hakkında sistem bildirimi (bkz. [Ajanlar](#ajanlar)); ilki varsayılan olarak açık, ikincisi kapalı.
- **Oturumlar için sistem bildirimi** — bu bildirimin kendisi, Claude Code simge durumundayken bile görünür; varsayılan olarak açık.
- **Oturum bildirimlerinin sesi** — “seni bekliyor” ve “bitirdi” farklı seslerle çalar; varsayılan olarak açık.
- **Ses düzeyi ve sesler** — bu seslerin ne kadar yüksek çalacağı (%10 ile %100 arası) ve “seni bekliyor” ile “yanıtını bitirdi” için hangi sesin çalacağı: varsayılan ses, Arcade için yapılmış beş sesten biri, bir sistem sesi ya da `~/.claude/arcade/sounds` klasörüne koyduğun 5 MB’a kadar bir `.wav` veya `.mp3` dosyası (macOS’ta `.aiff` ve `.m4a` da); *Klasörü aç* o klasörü açar. *Dinle* seçtiğini dinletir. Bir ses en fazla 10 saniye çalar; dosya artık yoksa ya da çalmıyorsa onun yerine varsayılan ses çalar. *“Seni bekliyor” tekrarı* (varsayılan olarak kapalı) oturum beklediği sürece sesi 5, 10, 30 ya da 60 saniyede bir, en fazla 10 kez yeniden çalar ve yanıt verince ya da oturumu gizleyince susar; Windows’ta kart kendiliğinden kaybolduysa onu geri de getirir, kartı kapatmak ise tekrarı durdurur. *Oturum bildirimlerinin sesi* hepsini yine kapatır.
- **Claude limiti %80 ve %90’da** — bir limit penceresi %80’e ve %90’a ulaştığında Arcade panelinde kısa bir uyarı (bkz. [Limitler](#limitler)); varsayılan olarak açık. Aynı anahtar, şu anki hızla bir pencerenin 20 dakikadan kısa sürede biteceğini söyleyen uyarıyı da kapsar.
- **Telefona bildirimler** — bir Claude Code oturumu 2 dakikadan uzun süredir yanıtını bekliyorsa Arcade sitesi telefonuna bir bildirim gönderir: *“api” oturumu seni bekliyor*. Bir panonun kuyruğu bittiğinde ya da durduğunda ve 2 dakika boyunca başında değilsen de aynısı olur: *“Sprint” panosundaki kuyruk bitti, kart: 2* ya da *“Sprint” panosundaki kuyruk durdu: Claude limiti doldu, sıfırlanma: 14:30*; kuyruğu kendin durdurursan bildirim gelmez. Bildirimde yalnızca oturumun ya da panonun adı, kaç kart yapıldığı ya da kuyruğun neden durduğu vardır; soru metni, kart başlıkları ve kod yoktur. En fazla 5 dakikada bir ve günde 30 kez gelir; bilgisayarda onu yalnızca bir oturum gönderir. *Telefon bağla* tek kullanımlık bir kod gösterir: telefonun tarayıcısında sitenin `/push` sayfasını aç ve kodu orada gir; telefonda giriş yapman gerekmez. Android Chrome’da olduğu gibi çalışır; iPhone’da önce o sayfayı Ana Ekran’a ekle ve kodu orada gir (iOS 16.4 veya daha yenisi). Bildirime dokununca o sayfa açılır; telefondan yanıt veremezsin. Bilgisayarda GitHub ile giriş yapmak gerekir; varsayılan olarak kapalı. *Bu bilgisayardan gönder* bunu tek bir bilgisayar için açar ya da kapatır, *Tüm telefonlarda kapat* bütün telefonları unutur, `/push` sayfası ise bildirimleri o telefonda kapatır.
- **Tuş testi ve tuş atama** (terminal).
- **Koşullar ve gizlilik** — sitenin Kullanım Koşulları ve Gizlilik Politikası, her zamanki tarayıcında açılır.

## Eklenti bilgisayarında ne yapar

Arcade, Claude Code’un eklentilere verdiği erişimle Claude Code içinde çalışır. Kodunun tamamı bu depodadır ve `claude plugin validate ./mod` bağlandığı her olayı ve yaptığı her çağrıyı listeler. Kısaca:

- **Ajanın araçları.** Arcade bir aracın ne zaman başlayıp bittiğini ve ajanın ne zaman izin istediğini görür — bildirimini ne zaman göstereceğini böyle bilir. Bir izin isteğini fark etmek için Claude Code’a ajanın çağrısı hakkında nasıl karar vereceğini sorar: bu denetim hiçbir şey çalıştırmaz ve hiçbir pencere açmaz. Arcade ajanın araç çağrılarını asla değiştirmez ya da engellemez ve hiçbirini kendisi onaylamaz. Kendi araçları — `mcp__arcade__notes` (yalnızca defteri değiştirir, hiçbir şey silmez) ve `mcp__arcade__calendar` (yalnızca takvimi değiştirir) — ve bir oyunun Desktop’un yerleşik tarayıcısında açılması, diğer her çağrı gibi Claude Code’un olağan izin denetiminden geçer; bu yüzden Claude bunları kullanmadan önce Claude Code sana sorabilir. İzin verme ve reddetme kuralların olduğu gibi geçerlidir. Claude’un defteri ve takvimi sormadan kullanması için `~/.claude/settings.json` içindeki `permissions.allow` listesine `mcp__arcade__notes` ve `mcp__arcade__calendar` ekle; Arcade bu ayarı asla kendisi yazmaz.
- **Ajanı durdurma.** Yalnızca Claude Desktop’ta, ajan çalışırken yerleşik tarayıcıda bir şey açtığında: Desktop bir eklentinin tarayıcıyı kendi başına açmasına izin vermez. Arcade o anki aracın bitmesini bekler (10 saniye sonra onu keser, ama ekranda bir izin sorusu olduğu sürece bekler), ajanı durdurur ve Claude’dan sayfayı açıp işine dönmesini ister. Bundan kaçınmak için *Ayarlar → Oyunları aç* bölümünden bir tarayıcı penceresi seç.
- **Sohbetin.** Konular için senin oturumundaki Haiku sohbetin sonunu, birkaç bin karakteri alır; bu, Claude kullanımına sayılır. Arcade sitesi sohbeti asla görmez. Arcade giriş kutusuna yalnızca sen istediğinde yazar ya da onu gönderir — örneğin defterdeki *Claude’a ver*, başlattığın *Claude için kuyruk*’un sıradaki kartı ya da *Claude’a ver* ile ayarlanmış bir etkinliğin saati gelince verdiği görev — ya da yukarıda anlatıldığı gibi bir sayfa açmak için. Yanıt bittiğinde Claude'un yanıtının başı, yaklaşık 160 karaktere kadar, *Ajanlar* ve *Bugün* için `~/.claude/arcade/agents` içindeki oturumun küçük dosyasına yazılır; yalnızca bu bilgisayarda kalır ve bunun için hiçbir model çağrılmaz.
- **Limitler.** Her yanıttan sonra ve yarım dakikada bir Arcade, Claude Code’dan kendi limit, bağlam ve maliyet ölçümünü ister — durum satırının gösterdiğini. Bunun bir maliyeti yoktur ve Claude kullanımına sayılmaz.
- **Programlar.** Arcade penceresi için tarayıcın (Windows’ta `%LOCALAPPDATA%\claude-arcade` içinde kendi profiliyle); bir bağlantı için her zamanki tarayıcın — Desktop dışında TikTok, GitHub ile giriş, defterden bağlantı verilen bir uygulamanın sayfası, *Projeye destek ol*, *Koşullar ve gizlilik* (Windows’ta PowerShell `Start-Process`, macOS’ta `open`, Linux’ta `xdg-open`, yalnızca https üzerinden web adresleri için); takvim hatırlatmaları, oturum bildirimleri ve yeni sohbet mesajı kartı dahil bildirimler — Windows’ta PowerShell, macOS’ta `osascript`, Linux’ta `notify-send`; Desktop’ta *Kopyala* için sistemin kopyalama panosu — Windows’ta PowerShell `Set-Clipboard`, macOS’ta `pbcopy`, Linux’ta `wl-copy`, `xclip` ya da `xsel`, metin standart girdiden verilir; hangi tarayıcıların kurulu olduğunun (Windows) ya da hangi sistem olduğunun (`uname`) kontrolü. Ayrıca *Ajanlar* için her oturumun kendi klasöründe, başlarken ve her yanıtın sonunda yalnızca okuyan `git` (`rev-parse`, `status` ve `diff --numstat`). Kartın *İnceleme* ekranı için ayrıca, kart Claude’a gittiğinde ve son sütuna ulaştığında oturumun klasöründe salt okunur `git` (`rev-parse`, `status`, `diff`, `log`). Ayrıca bir panoda *Kartlar arası kontrol* komutu varsa, kuyruktaki bir kart son sütuna geldiğinde oturumun klasöründe o komut. Oturum bildirimlerinin sesleri ve *Ses düzeyi ve sesler* içindeki *Dinle* için: Windows’ta PowerShell, macOS’ta `afplay`, Linux’ta `paplay` (10 saniye sonra `timeout` durdurur); ses dosyası argüman olarak ya da bir ortam değişkeninde verilir. Oradaki *Klasörü aç* için: Windows’ta `explorer.exe`, macOS’ta `open`, Linux’ta `xdg-open`.
- **Dosyalar.** Yalnızca `~/.claude/arcade` içine yazar: `/arcade-add` ile eklediğin ROM’lar, `roms/<sha256>.b64` olarak; *Ajanlar* ve *Limitler* için her oturumun küçük işareti, `agents/s<N>.json`, ve *Ajanlar*’dan gönderilen yanıtlar, `agents/a<N>.json`; “Oynamak ister misin?” satırının *Şimdi değil* ertelemesi, `ask-later.json`, ve Claude Code’un hangi açılışının şu anki olduğu, `ask-later-run.json`. Kartın *İnceleme* ekranının ayrıntılarını — dosya adları, diff’ler ve commit başlıkları — son 40 kart için `review/r<N>.json` dosyasına yazar. Bunların hiçbiri bir derleme, başlangıç, ayar ya da talimat dosyası değildir ve hiçbir şey onları çalıştırmaz. Yalnızca `/arcade-add`’e belirttiğin dosyayı, bu dosyaları ve kendi dosyalarını okur. Kartın *İnceleme* ekranı için, yalnızca sonraki değişiklikler sayılsın diye, kart Claude’a verildiğinde zaten değişmiş olan oturum klasöründeki dosyaları da (her biri en fazla 256 KB) okur. Ayarlar, defter, takvim ve favoriler Claude Code’un eklenti deposunda durur. Ayrıca `~/.claude/arcade/sounds` klasörüne koyduğun ses dosyalarını ve Windows’ta `C:\Windows\Media` içindeki seslerin listesini okur; `~/.claude/arcade/sounds` henüz yoksa *Klasörü aç* onu, içine hangi dosyaların konacağını anlatan bir `README.txt` ile oluşturur.
- **Ortam değişkenleri.** `HOME` ya da `USERPROFILE`, `LANG`, `LC_ALL`, `LC_MESSAGES`, `LOCALAPPDATA`, `OS` ve `WINDIR` değişkenlerini okur; hiçbirini değiştirmez.
- **Ağ.** Eklentinin kendisi yalnızca Arcade sitesiyle (`agent-arcade.fefaodessa.workers.dev`), YouTube kanallarının RSS akışlarıyla ve gösterdiği blog ve podcast’lerin akışlarıyla konuşur — bu akışların listesi Arcade sitesinden gelir, bir kopyası da eklentide bulunur. Desktop panelindeki resimler, örneğin Twitch avatarları, doğrudan bu hizmetlerden yüklenir. Oyunları, kitapları ve videoları tarayıcıda açtığın sayfa yükler.

## Gizlilik

Ayrıntılar sitenin [Gizlilik Politikası](https://agent-arcade.fefaodessa.workers.dev/privacy) ve [Kullanım Koşulları](https://agent-arcade.fefaodessa.workers.dev/terms) sayfalarında; eklentide *Ayarlar → Koşullar ve gizlilik* altında. Kısaca:

- Reklam yok, analiz yok, takip yok. Analiz koduyla gelen oyunlar bundan arındırıldı (her oyunun `NOTICE` dosyasına bak).
- Kendi ROM’ların, WAD’ların, kitapların ve ses dosyaların bilgisayarından ya da tarayıcından asla çıkmaz.
- Kitap ve sesli kitap listeleri ile Project Gutenberg kitapları Arcade sitesi üzerinden gelir: site bunları Project Gutenberg, Vikikaynak ve archive.org’dan alır ve yalnızca Cloudflare önbelleğinde tutar — listeleri altı saat, bir kitabı bir hafta. Vikikaynak sayfalarını ve LibriVox kayıtlarını pencere doğrudan bu sitelerden yükler.
- Çevrim içi oyun Cloudflare üzerindeki Arcade sunucusundan geçer: mesajlar bir odadaki oyuncular arasında aktarılır ve saklanmaz — geri dönebilmen için tutulan masa oyunu hamleleri hariç; bir ay boyunca dokunulmayan oyun silinir.
- Konuları kendi Claude Code oturumunda Haiku önerir; Arcade sitesi sohbetini asla görmez — *Kendi konun*’u kullandığında yalnızca kısa bir İngilizce arama sorgusu gider. Bir makalenin adresi `#` işaretinden sonra gelir, bu yüzden Arcade sunucusuna asla ulaşmaz.
- *Kendi konun* araması YouTube API Services üzerinden yapılır ve videolar YouTube’un kendi oynatıcısında oynar; bu yüzden [YouTube Hizmet Şartları](https://www.youtube.com/t/terms) ve [Google Gizlilik Politikası](https://policies.google.com/privacy) da geçerlidir. Kendi oturumundaki Haiku, başlıklarına ve kısa açıklamalarına bakarak en fazla altı video seçer; Arcade sitesi arama sonuçlarını ortak bir önbellekte bir gün tutar.
- Giriş yaptıktan sonra site eşitlenen ayarlarını, favorilerini, @takma adını, arkadaşlarını, sohbetlerini ve ortak panolarını saklar; oyun davetlerini ise 10 dakika tutar. Kimin çevrimiçi olduğunu yalnızca bellekte, bir buçuk dakika tutar. Oturum anahtarı yalnızca Arcade sitesine gönderilir.
- Telefona bildirimleri açarsan, bildirimler yalnızca bekleyen oturumun ya da kuyruğu biten veya duran panonun adını, kart sayısını ya da kısa ve sabit bir listeden bir durma nedenini (limit, hata, başarısız kontrol, kart son sütunda değil, pano silindi) taşır — soru metnini, kart başlıklarını, kodu ya da dosya adlarını asla taşımaz. Arcade sitesi bunları telefonundaki tarayıcının push hizmeti (Google, Apple, Mozilla ya da Microsoft) üzerinden şifreli gönderir; bu hizmet zamanı görür ama metni görmez. Site her telefon için (en fazla 5) tarayıcısının oluşturduğu push aboneliğini ve ne zaman bağlandığını, ayrıca limitler için bugünkü sayıyı ve son gönderim zamanını, sen kapatana kadar saklar.
- Defter ve takvim bilgisayarında kalır. Ortak panolar, tıpkı sohbetler gibi Arcade sitesinde saklanır ve şifrelenmez. Sayfalar Notion’a ya da başka bir uygulamaya yalnızca sen istediğinde, kendi Claude bağlayıcıların üzerinden gider; takip araçlarındaki issue’lar ve yorumlar da öyle — Arcade’in kendisi GitHub, Linear, Jira ya da başka takip araçlarıyla hiç konuşmaz.
- Proje notları olarak işaretlenen bir sayfa yalnızca kendi klasöründeki yeni Claude Code oturumlarının istemine girer — oraya yazdığın her şey gibi Claude’a gider. Hangi klasörün hangi sayfaya sahip olduğu ve her oturumun aldığı kopya, bu bilgisayarda Claude Code’un eklenti deposunda tutulur; eşitlenmez ve Arcade sitesine asla gitmez. Sayfanın başlığı ayrıca *Ajanlar* için oturumun dosyasına da girer.
- *Ajanlar* diğer oturumlarını `~/.claude/arcade/agents` içindeki küçük dosyalardan görür — her oturumun klasörü, durumu ve kartı, beklediği sorunun ya da izin isteğinin metni, komutuyla birlikte, ayrıca bağlamı, maliyeti ve limit pencereleri. *Ajanlar*’dan gönderilen yanıtlar da bunların yanında durur. Bu dosyalar bu bilgisayarda kalır ve asla Arcade sitesine gitmez; ortak panoda arkadaşların, eskisi gibi, yalnızca «üstlenen: @kullanıcı» görür. Git klasöründe oturumun dosyası dalını ve değişen dosyaların adlarını satır sayılarıyla da tutar — bunları git, oturumun kendi klasöründe okur ve hiçbir yere gönderilmez; Arcade hiçbir şeyi commit etmez, geri almaz, stash'e koymaz. Aynı dosyalarda her oturumda Claude'un son yanıtının başı da durur; modelsiz, olduğu gibi alınır ve o da bu bilgisayarda kalır.
- Kartın *İnceleme* ekranı — değişen dosyaların adları, satır sayıları, diff’ler ve commit başlıkları — bu bilgisayarda kalır: sayılar Claude Code’un eklenti deposunda, diff’ler son 40 kart için `~/.claude/arcade/review` içinde. Bunların hiçbiri Arcade’in sitesine gitmez; ortak bir panoda diğerleri yalnızca ✓ ya da ↩ ve yazdığın yorumu görür.
- Bir hata raporu metnini, Arcade sürümünü, nerede açık olduğunu, arayüz dilini ve işletim sistemini içerir — başka hiçbir şey; giriş yapmadan imzasız gider ve site hiçbir adres saklamaz.
- Bazı oyunlar internete yalnızca sen istersen çıkar — örneğin OpenTTD’nin isteğe bağlı anketi ve *Online Content* düğmesi.

## Platformlar ve durum

Arcade **beta** aşamasında: özellikler yerinde, çalışmalar ayrıntılarda sürüyor — bkz. [değişiklik günlüğü](CHANGELOG.md).

- Windows, macOS ve Linux’ta canlı olarak denendi.
- Terminalde, VS Code’da ve Claude Desktop’ta çalışır.

## Lisanslar

- **Oyunlar:** her oyunun kendi özgür lisansı var (MIT, GPL, BSD, Apache, Creative Commons ve diğerleri) — lisans metni ve kaynak kodu oyunun yanında durur ve kartından bağlantı verilir.
- **Kitaplar ve sesli kitaplar:** kamu malı; Arcade bunları saklamaz — kitaplar Project Gutenberg ve Vikikaynak’tan, kayıtlar LibriVox’tan (archive.org) sen açtığın anda gelir.
- **Emülatörler ve motorlar:** JSNES (Apache-2.0), çekirdekleriyle EmulatorJS (GPL-3.0), PrBoom (GPL-2.0), Cloudflare’in doom-wasm’ı ve Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (ek koşullarla GPL-3.0), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — satranç rakibi. Sega ve Master System için kullanılan Genesis Plus GX çekirdeği yalnızca ticari olmayan kullanım içindir.
- **Eklentinin içinde:** JSNES 2.1.0 emülatörü (Apache-2.0) ve çevrimdışı oynamak için üç amatör NES oyunu — Damian Yerrick’in *Thwaite* ve *Concentration Room* oyunları (GPL-3.0-or-later) ile Damian Yerrick’in Leonard Richardson’ın oyunundan uyarladığı *robotfindskitten* (zlib). Oyunlar `mod/hooks/roms/` içinde veri olarak saklanır; kaynak kodları (`.tar.gz`) ve lisans metinleri `mod/third_party/` içindedir.
- **Arcade’in kendi kodu** (eklenti ve site) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Onu özgürce kullanabilir, inceleyebilir ve değiştirebilirsin. Değiştirilmiş bir sürümü dağıtırsan — ya da başkaları için çevrim içi hizmet olarak çalıştırırsan —, tüm kaynak kodunu aynı lisansla yayımlaman ve telif hakkı bildirimlerini koruman gerekir. Üçüncü taraf bileşenler kendi lisanslarını korur. Eklentinin simgesi de olan Arcade logosu bu lisansın kapsamında değildir: yalnızca Arcade projesine atıfta bulunmak için kullanılabilir.

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
tools/   derleme araçları: çeviriler, heretic-wasm
.github/ doom-wasm, heretic-wasm, OpenTTD ve ScummVM'i tarayıcı için derleyen GitHub Actions
```

- Eklentiyi depodan çalıştırmak: `claude --plugin-dir ./mod`
- Eklenti testleri: `claude plugin validate ./mod`, ardından `mod/` içinde `claude plugin test`
- Site testleri: `site/` içinde `npm test`; derleme: `node build.mjs`; dağıtım `main` dalından Cloudflare Workers Builds ile otomatik yapılır.
- Çalışmalar `main` dalında yapılır, pull request'ler de oraya açılır. Varsayılan dal `plugin`, `site/` olmadan `main` dalının bir kopyasıdır ve her push'ta bir GitHub Action tarafından güncellenir: eklenti marketplace’i tüm depo yerine bu dalı indirir.
- Çeviriler: `node tools/i18n/collect.mjs`, ardından `node tools/i18n/check.mjs` — bkz. [tools/i18n/README.md](tools/i18n/README.md).

Ayrıntılı belgeler (Rusça): [mod/docs/README.ru.md](mod/docs/README.ru.md) — eklenti, [site/README.md](https://github.com/ArbakovMaxim/agent-arcade/tree/main/site/README.md) — site, oyun ekleme ve ağ üzerinden oyun.
