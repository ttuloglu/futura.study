# f-study: AI Destekli Kişiselleştirilmiş Öğrenme Platformu

Minimalist tasarım ve yapay zeka gücüyle oluşturulmuş, mobil öncelikli yeni nesil öğrenme deneyimi.

## Özellikler

*   **AI Müfredat Oluşturucu**: Herhangi bir konu için (Python, Makroekonomi, Sanat Tarihi vb.) anında yapılandırılmış ders planı oluşturur.
*   **Dinamik İçerik Üretimi**:
    *   **Ders Notları**: Akademik derinlikte, markdown formatında ders içerikleri.
    *   **Podcast Senaryoları**: Konuyu tartışan iki kişilik diyaloglar.
    *   **Sınavlar & Testler**: Öğrenilenleri pekiştirmek için zorluk seviyesine göre üretilen testler.
    *   **Akıllı Tekrar**: Başarısız olunan konularda eksikleri kapatmaya yönelik özel içerik.
*   **İlerleme Takibi**: Görselleştirilmiş ilerleme çubukları ve adım adım akış.
*   **Minimalist Arayüz**: Odaklanmayı artıran, modern ve temiz tasarım (Swiss Style).
*   **Asistan (AI Chat)**: Konu bağlamında soruları yanıtlayan kişisel asistan.

## Teknolojiler

*   **Frontend**: React 19, Tailwind CSS, Lucide React
*   **AI Gateway (Backend)**: Firebase Cloud Functions + Google Gemini API (`@google/genai`)
*   **Güvenlik**: Gemini anahtarı Google Secret Manager üzerinde saklanır (frontend'e verilmez)
*   **Mimari**: SPA + Backend API katmanı (frontend doğrudan model API çağrısı yapmaz)

## Kurulum

1.  Repoyu klonlayın.
2.  Root bağımlılıkları kurun: `npm install`
3.  Functions bağımlılıklarını kurun: `cd functions && npm install && cd ..`
4.  `.env` dosyasında sadece Firebase istemci anahtarlarını tanımlayın:
    * `VITE_FIREBASE_API_KEY`
    * `VITE_FIREBASE_AUTH_DOMAIN`
    * `VITE_FIREBASE_PROJECT_ID`
    * `VITE_FIREBASE_STORAGE_BUCKET`
    * `VITE_FIREBASE_MESSAGING_SENDER_ID`
    * `VITE_FIREBASE_APP_ID`
    * `VITE_FIREBASE_MEASUREMENT_ID`
5.  Gemini anahtarını Secret Manager'a yazın:
    * `firebase functions:secrets:set GEMINI_API_KEY`
6.  Function deploy edin:
    * `firebase deploy --only functions:aiGateway`
7.  Uygulamayı başlatın:
    * `npm run dev`

## Güvenlik Notları

*   Gemini API key artık frontend tarafından kullanılmaz ve `.env` içine konulmaz.
*   AI çağrılarının tamamı `aiGateway` Cloud Function üzerinden geçer.
*   Backend tarafında input doğrulama, operasyon whitelist'i ve istek/çıktı limitleri uygulanır.
