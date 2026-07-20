# Fortale — Create, Discover and Share

Fortale; fikirleri yapay zeka destekli, görselli ve sesli dijital kitaplara dönüştüren mobil öncelikli bir üretim, okuma ve paylaşım platformudur.

## Ürün Özellikleri

- **Masal, hikaye ve çalışma kitabı üretimi**: Alt tür, tema, yaş/seviye, karakter, zaman, mekan ve hikaye çekirdeğine göre kişiselleştirilmiş kitaplar.
- **Karakter portresi**: Yüklenen portreyi karakter kimliği için görsel referans olarak kullanma.
- **Görsel ve sesli okuma**: Kapak ve bölüm görselleri, sayfa seslendirmesi, podcast ve arka plan sesi desteği.
- **Çalışma kitabı seçenekleri**: Gerçek yaşam örnekleri, quiz ve ilgili kitap önerileri.
- **Kişisel kitaplık**: Arama, filtreleme, sıralama, bulut senkronizasyonu ve cihaz önbelleği.
- **Dışa aktarma**: Kitapları PDF ve EPUB olarak indirme ve paylaşma.
- **Topluluk**: Kitap yayınlama, önizleme, beğeni, yorum, takip, bildirim, şikayet ve moderasyon.
- **Çoklu dil**: Türkçe dahil 20 arayüz dili.
- **Kredi ekonomisi**: Kitap üretimi, portre kullanımı ve topluluk kitaplarını kişisel kitaplığa ekleme için kredi sistemi.

## Teknoloji

- **İstemci**: React 19, TypeScript, Vite, Tailwind CSS
- **Mobil**: Capacitor 8, iOS ve Android
- **Backend**: Firebase Authentication, Firestore, Storage, Cloud Functions ve Cloud Messaging
- **Yapay zeka**: Metin planlama ve üretiminde Gemini; görsel üretimi ve desteklenen ses akışlarında OpenAI
- **Satın alma**: RevenueCat üzerinden uygulama içi kredi paketleri

## Yerel Geliştirme

1. Ana bağımlılıkları kurun:

   ```bash
   npm install
   ```

2. Cloud Functions bağımlılıklarını kurun:

   ```bash
   cd functions
   npm install
   cd ..
   ```

3. Firebase istemci değişkenlerini `.env` dosyasına ekleyin:

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`

4. Uygulamayı başlatın:

   ```bash
   npm run dev
   ```

## Güvenlik ve Veri Mimarisi

- Model ve servis anahtarları istemciye verilmez; Secret Manager ve Cloud Functions üzerinden kullanılır.
- Kitaplar ve kullanıcı dosyaları kullanıcıya özel Firestore ve Storage yollarında saklanır.
- Kredi hareketleri ve topluluk mutasyonları doğrudan istemciden değil, sunucu tarafındaki doğrulanmış callable işlevlerden yürütülür.
- E-posta giriş kodları, kullanım limitleri, kredi cüzdanları ve moderasyon verileri sunucuya özeldir.

## Kontroller

```bash
npm run build
npm run i18n:check
```
