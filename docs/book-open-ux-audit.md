# Fortale Kitap Açılış UX Denetimi

## Kök Nedenler

- Kitap kartına basınca açılış işlemi `lastActivity` güncellemesi ve bulut yazımı tetikleyebiliyordu. Bu, yerelde hazır olan kitabın bile Firebase senkronizasyonu bekliyormuş gibi davranmasına neden oluyordu.
- iOS/Capacitor tarafında ZIP içindeki görsel ve sesler base64/data URL olarak React state ve tarayıcı storage katmanlarına taşınabiliyordu. Büyük kitaplarda bu WebView bellek baskısını artırıp restart riskini yükseltiyordu.
- Masal sesleri bazı eski akışlarda yerel ZIP yerine `contentPackageUrl` üzerinden tekrar çözümleniyordu. Bu, sesli masalda gereksiz Firebase Storage fetch riskini koruyordu.
- Web tarafında büyük kitap paketleri için `localStorage` güvenilir değildi. Refresh sonrası kitap içeriği tekrar Storage paketinden indirilebiliyordu.
- Native realtime Firestore listener sürekli açık kaldığında yerelde kurulu kitaplar bulut snapshot'ı ile yeniden eksik/hydration gereken duruma düşebiliyordu.
- Native snapshot içine yazılan `capacitor://` asset URL'leri iOS uygulama konteynerinin UUID'sini içeriyordu. Uygulama yeniden kurulduğunda veya simulator build/install sonrasında konteyner UUID'si değişiyor, dosyalar yeni konteynere taşınsa bile kayıtlı görsel ve ses URL'leri eski konteynere bakıyordu. Sonuç: kapaktan sonraki görseller yüklenmiyor ve anlatım sesi başlayamıyordu.

## Yeni Açılış Akışı

1. Kitap seçildiğinde önce yerel kurulum aranır.
2. Native uygulamada kitap paketi `smartbook-packages`, çıkarılan asset'ler `smartbook-assets`, hydrate edilmiş kurs snapshot'ı `smartbook-cache` altında sürümlü tutulur.
3. Web uygulamada ZIP paket blob'u ve hydrate edilmiş snapshot `fortale-smartbook-cache-v1` IndexedDB içinde tutulur.
4. Native snapshot kalıcı olarak konteyner URL'si değil `assets/...` paket yolunu saklar. Açılışta bu yol mevcut konteynerde yeniden `capacitor://` URL'sine çevrilir ve dosyanın varlığı ile sıfırdan büyük boyutu doğrulanır.
5. Görsel veya ses eksikse yalnız cihazdaki `book.zip` tekrar açılarak asset onarılır; Firebase medya URL'sinden oynatma yapılmaz.
6. Yerelde kurulu ve doğrulanmış snapshot varsa kitap doğrudan `ready` yapılır ve okuyucu açılır.
7. Kitaba basmak artık Firebase `lastActivity` yazımı, metadata repair veya Storage ZIP fetch başlatmaz.
8. Bulutta daha yeni paket varsa mevcut yerel sürüm açıldıktan sonra arka plan update kuyruğuna alınır. Okuyucu açıkken aktif içerik değiştirilmez.

## Network ve Cache Davranışı

- İlk üretim tamamlandığında kullanıcıya "kitap hazır" davranışı verilmeden önce istemci paketini yerel cache'e kurar.
- Sonraki açılışlar native dosya sistemi veya web IndexedDB üzerinden yapılır.
- Paketli kitap okuyucuya yalnız yerel kurulum doğrulandıktan sonra verilir. Cloud snapshot'taki node URL'leri paket kurulumu yerine doğrudan açılmaz.
- Kapak, sayfa görselleri ve masal sesleri native tarafta dosya URL'si, web tarafta yerel paket blob'undan oluşturulan object URL olarak verilir.
- Geçici `blob:` URL'ler ve büyük audio data URL'leri kalıcı `localStorage` payload'larına yazılmaz.
- Native Firestore realtime listener yalnızca işlenmekte olan, placeholder olan veya gerçekten buluttan metadata toparlaması gereken kitaplar için açık kalır.
- Native `library-index.json` artık Firestore'daki bütün rafı değil yalnız dosyası doğrulanmış kurulu kitapları içerir. Cloud raf birleşimi kurulu paket indexine yeni kayıt eklemez.
- İndirilen kitap durum taraması yalnız kurulu indexteki kitaplara uygulanır; içerik metadata'sı eksik görünen bütün cloud kitapları için `readdir/readFile` yapılmaz.
- Kapak cache'i kitap başına başarısız `readFile` denemek yerine klasörü bir kez listeler ve yalnız mevcut `.json` kayıtlarını okur.

## iOS Restart Riskini Azaltan Değişiklikler

- ZIP asset'leri native dosya sistemine çıkarılıyor; büyük görsel/ses içerikleri React state içinde base64 olarak taşınmıyor.
- Native tam kitap cache'i sürümlü ve idempotent çalışıyor.
- Açılış sırasında gereksiz Firestore yazımı ve Storage paketi indirmesi engellendi.
- Masal sesi ve sayfa görselleri açılış öncesinde yerel dosya olarak doğrulanıyor. Eksik asset varsa cihazdaki ZIP'ten onarılıyor; uzak medya URL'sine düşülmüyor.

## iOS Ses ve Legacy Kapak

- iOS WebKit `HTMLMediaElement.volume` değişikliğini uygulamadığı için fon müziği artık Web Audio `GainNode` üzerinden kontrol ediliyor.
- Önceki iOS denemesinde anlatım sırasında yaklaşık `-30 dB` kısılmış ayrı bir MP3'e geçildiği için `2.0x` gain gerçek ses kaybını telafi etmiyordu. Bu kaynak değişimi kaldırıldı; fon müziği her durumda cihazla paketlenen normal yerel MP3'ten oynatılıyor.
- iOS fon müziği gain'i boşta ve anlatım sırasında web taban değerlerinin `1.10x`'i olarak uygulanıyor. Böylece ses yükseltme doğrudan çalışan Web Audio hattında gerçekleşiyor; kısılmış dosya veya uzak medya fallback'i kullanılmıyor.
- Yatay görsel modunun ayrı Swiper örneği anlatımın aktif sayfa indeksiyle senkronlandı. Anlatım sonraki sayfaya geçtiğinde tam ekran görseli de aynı anda ilerliyor.
- Yatay görsel modunda açılan PDF/ePub indirme paneli görselle aynı yönde döndürülüp ekran merkezine sabitlendi.
- Yeni üretilen kitaplar ZIP'in yanında bağımsız `vN/cover.ext` nesnesi ve `coverImageUrl` metadata'sı oluşturuyor.
- Bağımsız kapağı bulunmayan eski kitaplarda `repairSmartBookCover` callable'ı kapağı sunucuda ZIP'ten çıkarıp küçük bir Storage nesnesi olarak yayımlıyor. Cihaz sırf raf kapağı için kitap ZIP'ini indirmiyor.

## Değişen Dosyalar

- `App.tsx`: local-first kitap açılışı, native/web paket cache API'leri, arka plan paket update kuyruğu, native realtime listener sınırlandırması.
- `views/HomeView.tsx`: `onCourseCreate` artık `Promise<void>` bekliyor; üretim tamamlandıktan sonra yerel kurulum bitmeden jenerasyon UI kapanmıyor.

## Doğrulama

- `npm run build`: geçti.
- `npm run sync:ios`: geçti.
- iOS simulator build/run: geçti (`App` scheme, iPhone 17 Pro iOS 26.1, sync sonrası).
- iOS konteyner değişimi testi: geçti. Eski snapshot `87681...` konteyner URL'lerini içerirken uygulama konteyneri sırasıyla `C563...` ve `54B7...` oldu; migration sonrası snapshot tüm medya alanlarında kararlı `assets/...` yollarını sakladı.
- Cihaz asset bütünlüğü: iki masalda toplam 16 sayfa görseli geçerli 1536x1024 PNG, 18 anlatım dosyası geçerli PCM 16-bit mono 24 kHz WAV olarak doğrulandı.
- Legacy kapak onarımı: callable production'a tek başına deploy edildi; onarılan raf kontrolünde eksik kapak sayısı `0`.
- iOS başlangıç logları: Firebase erken initialize edildi, APNs entitlement Debug/Release için tanımlandı ve simulator FCM token alımı doğrulandı.
- Fon müziği kaynak analizi: normal MP3 yaklaşık `-14.8 dB` ortalama / `-0.5 dB` tepe, kaldırılan ducked kaynak yaklaşık `-43.9 dB` ortalama / `-29.7 dB` tepe olarak ölçüldü.
- Son iOS simulator açılış logu: `OS-PLUG-FILE-0008 = 0`, kurulu olmayan `smartbook-packages` yoklaması `0`, ses/`AudioContext` oynatma hatası `0`.
- Son doğrulama: `npm run build`, `npx cap sync ios` ve XcodeBuildMCP `build_run_sim` geçti; uygulama iPhone 17 Pro simulatoründe raf kapaklarıyla açıldı.
- iOS gerçek cihaz hoparlöründen uçtan uca ses testi: manuel cihaz testi gerekli.
- Web refresh sonrası tekrar açılış: manuel browser testi gerekli.
- Masal sesli kitapta paket fetch olmadan anlatım: manuel simulator/browser testi gerekli.
