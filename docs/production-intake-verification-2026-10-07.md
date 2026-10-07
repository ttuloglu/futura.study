# Dört üretim yolu — alt tür ve görsel yön doğrulaması

7 Ekim 2026

Masal, hikâye, çalışma kitabı ve yabancı dilde hikâye akışları incelendi. Yabancı dilde hikâye, hikâye akışını hedef dil ve CEFR profiliyle kullanır; dil veya seviye alt türün yerine geçmez.

- Gerçek kullanıcı seçimi olmadan hazır taslağa geçilmez. Önerilen seçenek otomatik seçilmez. Kullanıcı “Diğer” ile kendi alt türünü de belirtebilir.
- Yanlış anlam taşıyan `book_subgenre` kimliği gerçek alt tür sorusunu atlatamaz. Soru anlamı ve gerçek kullanıcı cevabı denetlenir.
- Çalışma kitabında seçilen alan ile özel öğrenme konusu ayrı tutulur. Hem sıraya alınan hem doğrudan başlayan üretimde alan ve konu gereklidir.
- Eski sihirbazdaki alt türü otomatik seçme ve “Fortale’e bırak” geçişleri kaldırıldı. Otomatik olarak ilk katalog seçeneğine dönülmez.
- Planlayıcının çıktı şemasına açık görsel tercihi eklendi. İstekle uyumlu seçenekler sunması, konu-alan çatışmasında kapsamı netleştirmesi ve yabancı dil hikâyesini çalışma kitabına çevirmemesi istendi.
- Fantastik/bilimkurgu/alternatif dünya türlerinde otomatik belgesel fotoğraf seçilmez. Botanik levha tekniği çalışma kitabında doğa/biyoloji konularına ayrılır. Kullanıcı açıkça uygun bir tekniği seçerse otomatik çeşitlendirmeden önce gelir; kayıt edilen teknik de bu seçimi yansıtır.
- “Bilimkurgu”, “Distopya” ve “Tarihi” katalog etiketlerinin tür kurallarına ulaşmasını engelleyen yazım eşleşmeleri düzeltildi. Uyku ve hayvan masallarıyla alternatif dünya hikâyelerine özel yazım yönü eklendi.

## Doğrulama

41 hedefli test geçti. Dört yolun alt türü sorması, gerçek seçimin modelin farklı tercihine üstün gelmesi, Japonca B1 gibi hedef dil/seviye örneklerinin korunması, çalışma kitabı alan/konu denetimi ve görsel uyumu kapsandı. Mevcut gerçek sunucu planlayıcısı testleri de tekrar geçti; bunlar editör reddi, yeniden yazım ve başarısız kontrolün yayımlamayı engellemesini denetler.

Sunucu ve web derlemeleri başarılı. Genel TypeScript kontrolünde önceki hata kaydına göre yeni tanı yok. Hâlihazırdaki genel TypeScript hataları bu çalışmanın kapsamı dışında kalıyor. Değişikliklerde boşluk/biçim denetimi geçti.

Web ve üç üretim sunucu işlevi Firebase üzerinde güncellendi. Bu aşamada yeni bir tam kitap veya yeni görsel üretilmedi; doğrulama kod yolları ve kontrollü model yanıtları üzerinden yapıldı. Edebi kalite için önceki canlı plan/kapak denemesinin raporu `generation-quality-report-2026-10-07.md` dosyasında.

## İlham listesi — kullanıcı onayı bekliyor

Her tür için 50, toplam 200 Türkçe ilham hazırlandı. Her ilhamın tek cümlelik etiketi ve dört cümlelik briefi var; hikâye listesinin ilk 30 maddesi alternatif dünya fikri. `inspirations-review/ilhamlar-turkce.html` okunabilir inceleme, `ilhamlar-turkce.md` metin, `ilhamlar.tr.json` yapılandırılmış kaynak olarak hazırlandı.

Liste hiçbir uygulama bileşenine bağlanmadı; çeviriler, üç rastgele ilham satırı ve bütün ilhamlar modalı kullanıcının bu listeyi onaylamasından sonra eklenecek. İlham seçimi zorunlu alt tür adımını kaldırmayacak. Kayıtta masal için `fairy_tale`, hikâye için `novel`, çalışma kitabı için `story` kullanılması mevcut iç kod adlandırmasıdır; kullanıcıya gösterilen dört kategori inceleme listesinde açıkça ayrılmıştır.
