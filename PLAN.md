# Fortale — Ürün Yol Haritası

## Faz 1 — Wizard Yenileme & Yaratıcılık Derinleştirme

### 1.1 Yeni Alanlar
- [x] Kredi maliyetleri: fairy_tale=1, story=2, novel=2 (+1 portre) — zaten doğru
- [x] Misafir kullanıcı login prompt modal (LoginPromptModal.tsx)
- [x] **Ruh Hali (Mood)** seçimi — Step 1'e ekle (Macera / Komik / Sıcak / Gizemli / Eğitici)
- [x] **İkinci Karakter** (opsiyonel) — Step 4'e ekle (isim + ilişki tipi)
- [x] **Özel Öğe** (opsiyonel) — Step 5'e ekle (sihirli nesne / gizli sır / beklenmedik dost / serbest)
- [x] **Ders / Mesaj** (opsiyonel) — Step 3'e ekle (chip seçimi)
- [x] Yeni alanları AI prompt'larına dahil et

### 1.2 Premium Görsel Yenileme
- [x] Step başlıklarını yeniden yaz (premium kopya)
- [x] Step 2 (Alt Tür): küçük butonları büyük kartlara dönüştür
- [x] Tüm label font'larını büyüt (12px → 13-14px)
- [x] Step 3 (Tercihler): daha iyi layout ve gruplandırma
- [ ] İleri/Geri butonlarını premium hale getir
- [ ] Progress bar / step indicator'ı iyileştir

---

## Faz 2 — Topluluk Sayfası (Community)

### 2.1 Altyapı
- [x] `types.ts`: `CommunityBook` tip tanımı ekle
- [x] Firestore `communityBooks` koleksiyon şeması
- [x] Cloud Function: `publishToCommunity` (kitabı topluluğa yayınla)
- [x] Cloud Function: `downloadCommunityBook` (0.5 kredi kes, yaratıcıya 0.25 ver)

### 2.2 UI
- [x] `CommunityView.tsx` — keşif sayfası
  - Filtreler: Tür | Sıralama (Popüler/Yeni)
  - Editörün Seçimi bölümü (yatay kaydırma şeridi)
  - Kitap kartları: kapak + başlık + tür + ⬇ indirme sayısı + İndir butonu
- [x] Kitap kartına "Topluluğa Ekle" toggle (kitap tamamlandığında)
- [x] İndirme sayacı sistemi

### 2.3 Kredi Ekonomisi
- [x] Topluluktan indirme: **-0.5 kredi** (indiren)
- [x] Kitap indirildiğinde: **+0.25 kredi** (yaratıcı)
- [x] `creditCosts.ts`: `COMMUNITY_DOWNLOAD_CREDIT_COST = 0.5`
- [x] `creditCosts.ts`: `COMMUNITY_CREATOR_REWARD = 0.25`

---

## Faz 3 — Sosyal Paylaşım

### 3.1 Watermark Paylaşım Kartı
- [ ] Cloud Function: `generateShareCard` — kapak görseli + Fortale watermark → 9:16 PNG
- [ ] Firebase Storage: geçici share card URL (7 gün TTL)
- [ ] Frontend: "Paylaş" butonu → share card URL → Web Share API / navigator.share
- [ ] OG meta tag desteği (link önizlemesi için)

### 3.2 Deep Link
- [ ] Topluluk kitabı deep link şeması: `fortale://community?bookId=xxx`
- [ ] Web: `/community/[bookId]` sayfası (preview + üye ol CTA)

---

## Faz 4 — Editör Seçimi & Moderasyon

- [ ] Admin paneli veya Firestore flag: `isFeatured: boolean`
- [ ] İlk lansman için 10-15 kaliteli kitabı elle öne çıkar
- [ ] Basit "Şikayet Et" butonu (topluluk kartı üzerinde)
- [ ] Şikayet sayısı > 5 → otomatik gizle (moderasyon kuyruk)

---

## Teknik Notlar

### Kredi Yapısı (Sabit)
| Eylem | Kredi |
|---|---|
| Masal oluştur | -1 |
| Hikaye / Roman oluştur | -2 |
| Portre ekle | -1 ek |
| Topluluktan indirme | -0.5 |
| Kitabın indirilmesi (yaratıcı) | +0.25 |
| Yeni üye başlangıç kredisi | 3 |

### Yeni Wizard Alanları → Prompt Mapping
| Alan | Prompt'a nasıl giriyor |
|---|---|
| Ruh Hali | `Ton: [Macera/Komik/Sıcak/Gizemli/Eğitici]` — yazı stili ve atmosfer |
| İkinci Karakter | `İkinci karakter: [isim], [ilişki]` — karakter dinamiği |
| Özel Öğe | `Özel öğe: [seçim]` — plot device |
| Ders / Mesaj | `Bu kitap şunu öğretsin: [seçim]` — tematik yön |
