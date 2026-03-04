export interface PolicySection {
  title: string;
  content: string;
}

export interface PolicyDocument {
  title: string;
  lastUpdatedLabel: string;
  lastUpdatedDate: string;
  sections: PolicySection[];
}

export const LEGAL_CONSENT_VERSION = '2026-03-03';

export const defaultTermsPolicy: PolicyDocument = {
  title: 'Fortale Kullanım Şartları',
  lastUpdatedLabel: 'Son güncelleme: ',
  lastUpdatedDate: '3 Mart 2026',
  sections: [
    {
      title: '1. Kapsam ve Kabul',
      content:
        'Bu Kullanım Şartları, Fortale uygulamasını ve ilişkili web, iOS ve Android deneyimlerini kullanımınızı düzenler. Fortale; yapay zeka destekli kitap oluşturma, kapak ve bölüm görselleri üretme, podcast/ses çıktısı hazırlama, PDF ve EPUB dışa aktarma, paylaşım bağlantısı oluşturma ve kişisel kütüphane yönetimi gibi özellikler sunar.\n\nHesap oluşturarak, misafir oturumu açarak, içerik üreterek veya hizmeti kullanmaya devam ederek bu şartları kabul etmiş olursunuz. Bu şartları kabul etmiyorsanız hizmeti kullanmamalısınız.'
    },
    {
      title: '2. Uygunluk, Hesap ve Güvenlik',
      content:
        'Hizmeti, bulunduğunuz yerde geçerli yaş ve sözleşme kurallarına uygun olarak kullanmanız gerekir. Reşit değilseniz ebeveyn veya yasal temsilci izniyle işlem yapmalısınız.\n\nGiriş bilgilerinizin, cihaz güvenliğinizin ve hesabınız üzerinden yapılan işlemlerin korunması sizin sorumluluğunuzdadır. Hesabınızın izinsiz kullanıldığını düşünüyorsanız bize gecikmeden bildirmelisiniz.'
    },
    {
      title: '3. Hizmetin Niteliği',
      content:
        'Fortale, kullanıcı girdilerine göre hikaye, masal, roman, açıklayıcı içerik, görsel, ses ve dışa aktarım dosyaları üreten bir dijital üretim hizmetidir. Hizmetin bazı bölümleri üçüncü taraf altyapılar, depolama sağlayıcıları, kimlik doğrulama çözümleri ve ödeme servisleri üzerinden çalışabilir.\n\nHizmet sürekli, hatasız veya kesintisiz çalışma garantisi vermez. Özellikler, planlar, kredi akışları, desteklenen dosya türleri ve teknik sınırlar zaman içinde değiştirilebilir.'
    },
    {
      title: '4. Krediler, Satın Alımlar ve Üyelikler',
      content:
        'Fortale içindeki bazı işlemler kredi, paket satın alımı veya üyelik kapsamında sunulabilir. Bir işlem kredi tüketecekse bu bilgi işlem başlamadan önce kullanıcı arayüzünde gösterilmeye çalışılır.\n\nApple App Store, Google Play veya diğer ödeme sağlayıcıları üzerinden yapılan satın alımlarda ilgili mağaza veya sağlayıcının ek koşulları da uygulanabilir. Fiyatlar, paket içerikleri, üyelik kapsamı, deneme teklifleri ve yenileme akışları zaman zaman güncellenebilir.\n\nTeknik hata, başarısız üretim veya sistem kaynaklı kesinti durumlarında kredi iadesi tamamen veya kısmen uygulanabilir; ancak her üretim talebinin otomatik iade hakkı doğurduğu kabul edilmez.'
    },
    {
      title: '5. Kullanıcı İçeriği ve İşleme Yetkisi',
      content:
        'Fortale\'e yazdığınız istemler, yüklediğiniz dosyalar, notlar, karakter adları, özel metinler ve diğer girdiler sizin sorumluluğunuzdadır. Bu içerikleri hizmeti sunmak, depolamak, senkronize etmek, dönüştürmek, yedeklemek, dışa aktarmak ve güvenlik/uyumluluk kontrolleri yapmak için işlememize izin vermiş olursunuz.\n\nİçeriğiniz üzerindeki sahip olduğunuz haklar, uygulanabilir hukuk çerçevesinde sizde kalır. Ancak hizmeti çalıştırabilmemiz için gerekli olan sınırlı, geri alınabilir ve hizmete bağlı işleme yetkisini bize vermiş olursunuz.'
    },
    {
      title: '6. Yapay Zeka Üretimleri ve Doğruluk Sınırı',
      content:
        'Fortale içinde üretilen metin, görsel, ses, özet, test, başlık, kapak ve benzeri tüm çıktılar yapay zeka destekli olabilir. Bu nedenle içerikler hatalı, eksik, tekrar eden, önyargılı, teknik olarak kusurlu veya üçüncü kişi haklarını etkileyebilecek nitelikte olabilir.\n\nÖzellikle ticari yayın, eğitim materyali dağıtımı, profesyonel danışmanlık, çocuklara yönelik kullanım, reklam, marka kullanımı veya kamuya açık paylaşım öncesinde nihai kontrol kullanıcıya aittir. Fortale çıktıları tek başına editoryal, hukuki, tıbbi, finansal veya mesleki tavsiye olarak değerlendirilmemelidir.'
    },
    {
      title: '7. Paylaşım, Keşfet ve Kamuya Açık İçerikler',
      content:
        'Fortale içinde oluşturduğunuz bazı içerikler paylaşım bağlantısı, keşfet ekranı veya benzeri kamuya açık alanlar üzerinden görünür hale gelebilir. Bir içeriği paylaşıma açtığınızda, bu içeriğin bağlantıya erişen kişilerce görüntülenebileceğini kabul edersiniz.\n\nKamuya açık içeriklerde yasal risk, telif ihlali, kişisel veri sorunu, müstehcenlik, çocuk güvenliği veya topluluk güvenliğini etkileyen durumlar tespit edilirse ilgili içeriği kaldırabilir, görünürlüğünü azaltabilir veya erişimi sınırlandırabiliriz.'
    },
    {
      title: '8. Yasaklı Kullanımlar',
      content:
        'Aşağıdaki kullanım türleri yasaktır:\n' +
        '• Çocukların cinsel istismarı, cinsel şiddet, insan ticareti, terör, organize suç veya ağır zarar üretimine yönelik içerikler\n' +
        '• Nefret söylemi, hedefli taciz, ayrımcılık çağrısı, açık şiddet teşviki veya gerçek kişilere zarar verme amaçlı kullanım\n' +
        '• Telif, marka, kişilik hakkı veya gizlilik ihlali oluşturan yükleme ve üretimler\n' +
        '• Kimlik avı, dolandırıcılık, yanıltıcı ticari kullanım, spam veya kötü amaçlı otomasyon\n' +
        '• Güvenlik önlemlerini aşmaya çalışma, tersine mühendislik, aşırı yük bindirme veya hizmete zarar verme girişimi\n\n' +
        'Bu tür kullanımlar tespit edildiğinde üretim engellenebilir, hesap erişimi sınırlandırılabilir ve gerekli görülürse yasal süreçlere uyum için kayıt tutulabilir.'
    },
    {
      title: '9. Fikri Mülkiyet ve Fortale Hakları',
      content:
        'Fortale uygulamasının kendisi, arayüzü, markası, logosu, yazılımı, tasarımı ve hizmet altyapısı üzerindeki haklar Fortale\'e veya lisans verenlerine aittir. Bu şartlar size uygulama üzerinde yalnızca sınırlı, geri alınabilir ve kişisel kullanım lisansı verir.\n\nFortale markasını, görsel varlıklarını veya yazılım bileşenlerini önceden yazılı izin olmadan kopyalayamaz, satamaz, lisanslayamaz veya ayrı bir ürünün parçası haline getiremezsiniz.'
    },
    {
      title: '10. Hesap Silme, Askıya Alma ve Sonlandırma',
      content:
        'Hesabınızı uygulama içindeki ilgili ayarlar veya destek kanalları üzerinden silme talebinde bulunabilirsiniz. Hesap silme işlemi, uygulanabilir hukuk gereği saklanması zorunlu kayıtlar hariç olmak üzere hesabınızla ilişkili verilerin silinmesi veya erişime kapatılması sonucunu doğurabilir.\n\nŞart ihlali, kötüye kullanım, güvenlik riski, ödeme suistimali, resmi makam talebi veya hizmet bütünlüğünü koruma ihtiyacı halinde hesabı, belirli özellikleri veya kamuya açık içerikleri geçici ya da kalıcı olarak askıya alabiliriz.'
    },
    {
      title: '11. Garanti Feragati ve Sorumluluk Sınırı',
      content:
        'Hizmet, mevzuatın izin verdiği ölçüde "olduğu gibi" ve "mevcut olduğu ölçüde" sunulur. Hizmetin kesintisiz çalışacağı, tüm içeriklerin hatasız olacağı veya her çıktının belirli bir amaca uygun olacağı garanti edilmez.\n\nZorunlu tüketici hakları saklı kalmak üzere, dolaylı zararlar, veri kaybı, iş kesintisi, itibar kaybı, beklenen kazanç kaybı veya üçüncü kişi taleplerinden doğan sonuçlar bakımından sorumluluğumuz hukukun izin verdiği ölçüde sınırlı olabilir.'
    },
    {
      title: '12. Güncellemeler ve İletişim',
      content:
        'Bu şartları zaman zaman güncelleyebiliriz. Yeni sürüm yayınlandığında üstteki son güncelleme tarihi yenilenir ve güncel metin, yayınlandığı tarihten itibaren geçerli olur. Önemli değişikliklerde uygulama içinde ek bildirim göstermeyi tercih edebiliriz.\n\nKullanım Şartları ile ilgili sorular için bizimle şu adresten iletişime geçebilirsiniz: admin@futurumapps.online'
    }
  ]
};

export const defaultPrivacyPolicy: PolicyDocument = {
  title: 'Fortale Gizlilik Politikası',
  lastUpdatedLabel: 'Son güncelleme: ',
  lastUpdatedDate: '1 Mart 2026',
  sections: [
    {
      title: '1. Kapsam',
      content:
        'Bu politika, Fortale platformunu web, ios ve android ortamlarında kullanırken kişisel verilerin nasıl işlendiğini açıklar. Politika; KVKK, GDPR/UK GDPR ve CCPA/CPRA benzeri veri koruma ilkeleri dikkate alınarak hazırlanmıştır.'
    },
    {
      title: '2. Veri Sorumlusu ve İletişim',
      content:
        'Veri sorumlusu: Fortale\n' +
        'İletişim: admin@futurumapps.online'
    },
    {
      title: '3. Toplanan Veri Türleri',
      content:
        'Kullanıma bağlı olarak şu veriler işlenebilir:\n' +
        '• Hesap verisi: ad/rumuz, e-posta, kimlik doğrulama sağlayıcı bilgileri\n' +
        '• İçerik verisi: istemler, karakter bilgileri, üretilen masal/hikaye/roman metinleri, görsel istemleri ve çıktı metadataları\n' +
        '• Medya verisi: kapak/bölüm görselleri, podcast ses dosyaları ve üretim kayıtları\n' +
        '• Kredi/işlem verisi: kredi bakiyesi, kredi tüketim-iade kayıtları, işlem zaman damgaları\n' +
        '• Kullanım ve teknik veriler: ip adresi, cihaz bilgisi, hata/perf logları, güvenlik sinyalleri'
    },
    {
      title: '4. Verilerin Kullanım Amaçları',
      content:
        'Veriler şu amaçlarla kullanılır:\n' +
        '• Kitap üretimi, görsel üretimi, dışa aktarma ve podcast üretimi hizmetlerini sağlamak\n' +
        '• Kredi sistemi işlemlerini yürütmek (tüketim, iade, bakiye güncelleme)\n' +
        '• Güvenlik, dolandırıcılık ve kötüye kullanım tespitini yapmak\n' +
        '• Yasal uygunluk kontrollerini uygulamak\n' +
        '• Destek taleplerini yanıtlamak ve ürün kalitesini iyileştirmek'
    },
    {
      title: '5. Hukuki Dayanak',
      content:
        'İşleme faaliyetleri, uygulanabilir hukuk kapsamında şu dayanaklara yaslanabilir:\n' +
        '• Sözleşmenin kurulması/ifası\n' +
        '• Yasal yükümlülüklerin yerine getirilmesi\n' +
        '• Meşru menfaat (güvenlik, suistimal önleme, hizmet sürekliliği)\n' +
        '• Gerekli hallerde açık rıza'
    },
    {
      title: '6. Ai İşleme, İçerik Uygunluğu ve Güvenlik Katmanı',
      content:
        'Kitap ve podcast üretim akışlarında girdileriniz yapay zeka modelleri tarafından işlenebilir. Yasal uyumluluğu güçlendirmek için istem ve çıktı seviyesinde otomatik içerik kontrolleri uygulanır.\n\nRiskli içerik tespitinde üretim sınırlandırılabilir, durdurulabilir veya ek doğrulama istenebilir. Fortale, kişisel verileri reklam amacıyla satmaz.'
    },
    {
      title: '7. Çocuk Verileri ve Ebeveyn Onayı',
      content:
        'Çocuklara yönelik içerik üretimi desteklense de kişisel verilerin işlenmesi, ilgili ülke hukukundaki yaş ve ebeveyn onayı kurallarına tabidir.\n\nYasal olarak gerekli durumlarda ebeveyn doğrulaması, ek bildirim ve sınırlı işlem prensipleri uygulanabilir.'
    },
    {
      title: '8. Paylaşım, İşleyenler ve Resmi Talepler',
      content:
        'Veriler pazarlama amacıyla üçüncü taraflara satılmaz. Altyapı, model erişimi, depolama ve güvenlik hizmetleri için veri işleyen tedarikçiler kullanılabilir.\n\nYetkili kurumlardan usule uygun resmi talep gelmesi halinde, yalnızca gerekli ve hukuken zorunlu kapsamda paylaşım yapılır.'
    },
    {
      title: '9. Uluslararası Aktarım',
      content:
        'Veriler, bulunduğunuz ülke dışında yer alan sunucularda işlenebilir. Böyle durumlarda sözleşmesel, idari ve teknik koruma tedbirleri uygulanır.'
    },
    {
      title: '10. Saklama Süresi ve Silme',
      content:
        'Veriler, işleme amacı için gerekli süre kadar saklanır. Süre sonunda silme, anonimleştirme veya erişim kısıtlama yöntemleri uygulanır.\n\nYasal uyuşmazlık, denetim, güvenlik incelemesi veya resmi talep halinde bazı kayıtlar mevzuatın izin verdiği süre boyunca tutulabilir.'
    },
    {
      title: '11. Güvenlik Önlemleri',
      content:
        'Fortale; şifreleme, erişim kontrolü, kimlik doğrulama, anahtar yönetimi, loglama ve kötüye kullanım tespit mekanizmaları gibi teknik-idari önlemler uygular.\n\nBuna rağmen hiçbir sistem mutlak güvenlik garantisi vermez.'
    },
    {
      title: '12. Haklarınız',
      content:
        'Uygulanabilir mevzuata göre erişim, düzeltme, silme, işlemeyi sınırlama, itiraz, veri taşınabilirliği ve şikayet gibi haklara sahip olabilirsiniz.\n\nCCPA/CPRA kapsamındaki haklar (bilme, silme, düzeltme, paylaşım/satışa itiraz, hassas veri kullanımını sınırlama) ilgili uygunluk şartlarına göre değerlendirilebilir.\n\nHak talepleri için: admin@futurumapps.online'
    },
    {
      title: '13. Politika Güncellemeleri',
      content:
        'Bu politika zaman zaman güncellenebilir. Yeni sürüm yayımlandığında son güncelleme tarihi yenilenir ve yayınlanan metin yürürlüğe girer.'
    }
  ]
};
