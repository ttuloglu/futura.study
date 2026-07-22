import type { AppLanguageCode } from './appLanguages';

export type OnboardingV2Copy = {
  heroTitle: string;
  heroBody: string;
  prompt: string;
  chooseTitle: string;
  fairyChoice: string;
  storyChoice: string;
  workbookChoice: string;
  transformationTitle: string;
  languageTitle: string;
  finalTitle: string;
  finalBody: string;
  primaryCta: string;
  secondaryCta: string;
  fairyCoverTitle: string;
  storyCoverTitle: string;
  workbookCoverTitle: string;
};

export type OnboardingV2Labels = {
  idea: string;
  title: string;
  sectionsAndVisuals: string;
  writeYourIdea: string;
  completeBook: string;
  youChoose: string;
  library: string;
};

export const ONBOARDING_V2_COPY: Record<AppLanguageCode, OnboardingV2Copy> = {
  ar: {
    heroTitle: 'فكرة واحدة. كتاب ينبض بالحياة.',
    heroBody: 'يحوّل Fortale فكرتك إلى كتاب مصوّر ومسموع وقابل للمشاركة.',
    prompt: 'لماذا يمرّ الوقت ببطء أحيانًا؟',
    chooseTitle: 'ماذا تريد أن تصنع اليوم؟',
    fairyChoice: 'حكاية لطفلي',
    storyChoice: 'كتابة قصة',
    workbookChoice: 'تعلّم موضوع',
    transformationTitle: 'من الفكرة إلى الكتاب',
    languageTitle: 'أنشئ واقرأ واستمع بـ20 لغة.',
    finalTitle: 'اقرأ. استمع. نزّل. شارك.',
    finalBody: 'كتبك معك على جهازك وفي مكتبتك وفي المجتمع.',
    primaryCta: 'أنشئ كتابي الأول',
    secondaryCta: 'استكشف الأمثلة',
    fairyCoverTitle: 'ليلى تبحث عن الزمن',
    storyCoverTitle: 'المدينة التي صمتت ساعاتها',
    workbookCoverTitle: 'مرونة الزمن'
  },
  da: {
    heroTitle: 'Én idé. En levende bog.',
    heroBody: 'Fortale forvandler din idé til en illustreret, indtalt og delbar bog.',
    prompt: 'Hvorfor går tiden nogle gange langsommere?',
    chooseTitle: 'Hvad vil du skabe i dag?',
    fairyChoice: 'Et eventyr til mit barn',
    storyChoice: 'Skrive en historie',
    workbookChoice: 'Lære om et emne',
    transformationTitle: 'Fra idé til bog',
    languageTitle: 'Skab, læs og lyt på 20 sprog.',
    finalTitle: 'Læs. Lyt. Hent. Del.',
    finalBody: 'Dine bøger følger dig på enheden, i biblioteket og i fællesskabet.',
    primaryCta: 'Opret min første bog',
    secondaryCta: 'Udforsk eksempler',
    fairyCoverTitle: 'Lila leder efter tiden',
    storyCoverTitle: 'Byen hvor urene tav',
    workbookCoverTitle: 'Tidens elasticitet'
  },
  de: {
    heroTitle: 'Eine Idee. Ein lebendiges Buch.',
    heroBody: 'Fortale verwandelt deine Idee in ein illustriertes, vertontes und teilbares Buch.',
    prompt: 'Warum vergeht die Zeit manchmal langsamer?',
    chooseTitle: 'Was möchtest du heute erschaffen?',
    fairyChoice: 'Ein Märchen für mein Kind',
    storyChoice: 'Eine Geschichte schreiben',
    workbookChoice: 'Ein Thema verstehen',
    transformationTitle: 'Von der Idee zum Buch',
    languageTitle: 'In 20 Sprachen erstellen, lesen und hören.',
    finalTitle: 'Lesen. Hören. Laden. Teilen.',
    finalBody: 'Deine Bücher begleiten dich auf deinem Gerät, in deiner Bibliothek und in der Community.',
    primaryCta: 'Mein erstes Buch erstellen',
    secondaryCta: 'Beispiele entdecken',
    fairyCoverTitle: 'Lila sucht die Zeit',
    storyCoverTitle: 'Die Stadt der schweigenden Uhren',
    workbookCoverTitle: 'Die Elastizität der Zeit'
  },
  el: {
    heroTitle: 'Μία ιδέα. Ένα βιβλίο που ζωντανεύει.',
    heroBody: 'Το Fortale μετατρέπει την ιδέα σου σε εικονογραφημένο, ηχητικό και κοινοποιήσιμο βιβλίο.',
    prompt: 'Γιατί ο χρόνος μερικές φορές κυλά πιο αργά;',
    chooseTitle: 'Τι θέλεις να δημιουργήσεις σήμερα;',
    fairyChoice: 'Ένα παραμύθι για το παιδί μου',
    storyChoice: 'Να γράψω μια ιστορία',
    workbookChoice: 'Να μάθω ένα θέμα',
    transformationTitle: 'Από την ιδέα στο βιβλίο',
    languageTitle: 'Δημιούργησε, διάβασε και άκουσε σε 20 γλώσσες.',
    finalTitle: 'Διάβασε. Άκουσε. Κατέβασε. Μοιράσου.',
    finalBody: 'Τα βιβλία σου μαζί σου στη συσκευή, στη βιβλιοθήκη και στην κοινότητα.',
    primaryCta: 'Δημιουργία πρώτου βιβλίου',
    secondaryCta: 'Εξερεύνηση παραδειγμάτων',
    fairyCoverTitle: 'Η Λίλα αναζητά τον χρόνο',
    storyCoverTitle: 'Η πόλη όπου σώπασαν τα ρολόγια',
    workbookCoverTitle: 'Η ελαστικότητα του χρόνου'
  },
  en: {
    heroTitle: 'One idea. A living book.',
    heroBody: 'Fortale is an AI-powered creative app that turns ideas into illustrated and narrated books, stories, fairy tales and workbooks you can read, listen to, download and share.',
    prompt: 'Why does time sometimes slow down?',
    chooseTitle: 'What do you want to create today?',
    fairyChoice: 'A tale for my child',
    storyChoice: 'Write a story',
    workbookChoice: 'Learn a subject',
    transformationTitle: 'From idea to book',
    languageTitle: 'Create, read and listen in 20 languages.',
    finalTitle: 'Read. Listen. Download. Share.',
    finalBody: 'Your books stay with you on your device, in your library and in the community.',
    primaryCta: 'Create my first book',
    secondaryCta: 'Explore examples',
    fairyCoverTitle: 'Lila in Search of Time',
    storyCoverTitle: 'The City Where Clocks Fell Silent',
    workbookCoverTitle: 'The Elasticity of Time'
  },
  es: {
    heroTitle: 'Una idea. Un libro que cobra vida.',
    heroBody: 'Fortale convierte tu idea en un libro ilustrado, narrado y listo para compartir.',
    prompt: '¿Por qué el tiempo a veces pasa más despacio?',
    chooseTitle: '¿Qué quieres crear hoy?',
    fairyChoice: 'Un cuento para mi peque',
    storyChoice: 'Escribir una historia',
    workbookChoice: 'Aprender un tema',
    transformationTitle: 'De la idea al libro',
    languageTitle: 'Crea, lee y escucha en 20 idiomas.',
    finalTitle: 'Lee. Escucha. Descarga. Comparte.',
    finalBody: 'Tus libros te acompañan en tu dispositivo, tu biblioteca y la comunidad.',
    primaryCta: 'Crear mi primer libro',
    secondaryCta: 'Explorar ejemplos',
    fairyCoverTitle: 'Lila en busca del tiempo',
    storyCoverTitle: 'La ciudad donde callaron los relojes',
    workbookCoverTitle: 'La elasticidad del tiempo'
  },
  fi: {
    heroTitle: 'Yksi idea. Elävä kirja.',
    heroBody: 'Fortale muuttaa ideasi kuvitetuksi, äänitetyksi ja jaettavaksi kirjaksi.',
    prompt: 'Miksi aika kulkee joskus hitaammin?',
    chooseTitle: 'Mitä haluat luoda tänään?',
    fairyChoice: 'Satu lapselleni',
    storyChoice: 'Kirjoita tarina',
    workbookChoice: 'Opi jokin aihe',
    transformationTitle: 'Ideasta kirjaksi',
    languageTitle: 'Luo, lue ja kuuntele 20 kielellä.',
    finalTitle: 'Lue. Kuuntele. Lataa. Jaa.',
    finalBody: 'Kirjasi kulkevat mukanasi laitteella, kirjastossa ja yhteisössä.',
    primaryCta: 'Luo ensimmäinen kirjani',
    secondaryCta: 'Tutustu esimerkkeihin',
    fairyCoverTitle: 'Lila etsii aikaa',
    storyCoverTitle: 'Kaupunki jossa kellot vaikenivat',
    workbookCoverTitle: 'Ajan joustavuus'
  },
  fr: {
    heroTitle: 'Une idée. Un livre vivant.',
    heroBody: 'Fortale transforme ton idée en un livre illustré, raconté et prêt à partager.',
    prompt: 'Pourquoi le temps ralentit-il parfois ?',
    chooseTitle: 'Que veux-tu créer aujourd’hui ?',
    fairyChoice: 'Un conte pour mon enfant',
    storyChoice: 'Écrire une histoire',
    workbookChoice: 'Comprendre un sujet',
    transformationTitle: 'De l’idée au livre',
    languageTitle: 'Crée, lis et écoute dans 20 langues.',
    finalTitle: 'Lis. Écoute. Télécharge. Partage.',
    finalBody: 'Tes livres te suivent sur ton appareil, dans ta bibliothèque et la communauté.',
    primaryCta: 'Créer mon premier livre',
    secondaryCta: 'Explorer les exemples',
    fairyCoverTitle: 'Lila à la recherche du temps',
    storyCoverTitle: 'La ville où les horloges se turent',
    workbookCoverTitle: 'L’élasticité du temps'
  },
  hi: {
    heroTitle: 'एक विचार। एक जीवंत किताब।',
    heroBody: 'Fortale आपके विचार को चित्रित, सुनाई देने वाली और साझा करने योग्य किताब में बदलता है।',
    prompt: 'समय कभी-कभी धीमा क्यों हो जाता है?',
    chooseTitle: 'आज आप क्या बनाना चाहते हैं?',
    fairyChoice: 'मेरे बच्चे के लिए कहानी',
    storyChoice: 'एक कहानी लिखना',
    workbookChoice: 'किसी विषय को सीखना',
    transformationTitle: 'विचार से किताब तक',
    languageTitle: '20 भाषाओं में बनाएँ, पढ़ें और सुनें।',
    finalTitle: 'पढ़ें। सुनें। डाउनलोड करें। साझा करें।',
    finalBody: 'आपकी किताबें आपके डिवाइस, लाइब्रेरी और समुदाय में हमेशा आपके साथ रहती हैं।',
    primaryCta: 'मेरी पहली किताब बनाएँ',
    secondaryCta: 'उदाहरण देखें',
    fairyCoverTitle: 'समय की तलाश में लीला',
    storyCoverTitle: 'वह शहर जहाँ घड़ियाँ चुप हो गईं',
    workbookCoverTitle: 'समय का लचीलापन'
  },
  id: {
    heroTitle: 'Satu ide. Sebuah buku yang hidup.',
    heroBody: 'Fortale mengubah idemu menjadi buku bergambar, bersuara, dan siap dibagikan.',
    prompt: 'Mengapa waktu terkadang berjalan lebih lambat?',
    chooseTitle: 'Apa yang ingin kamu buat hari ini?',
    fairyChoice: 'Dongeng untuk anakku',
    storyChoice: 'Menulis sebuah cerita',
    workbookChoice: 'Mempelajari suatu topik',
    transformationTitle: 'Dari ide menjadi buku',
    languageTitle: 'Buat, baca, dan dengarkan dalam 20 bahasa.',
    finalTitle: 'Baca. Dengarkan. Unduh. Bagikan.',
    finalBody: 'Bukumu selalu bersamamu di perangkat, perpustakaan, dan komunitas.',
    primaryCta: 'Buat buku pertamaku',
    secondaryCta: 'Jelajahi contoh',
    fairyCoverTitle: 'Lila Mencari Waktu',
    storyCoverTitle: 'Kota Saat Jam Berhenti Berdetak',
    workbookCoverTitle: 'Elastisitas Waktu'
  },
  it: {
    heroTitle: 'Un’idea. Un libro che prende vita.',
    heroBody: 'Fortale trasforma la tua idea in un libro illustrato, narrato e condivisibile.',
    prompt: 'Perché a volte il tempo rallenta?',
    chooseTitle: 'Cosa vuoi creare oggi?',
    fairyChoice: 'Una fiaba per mio figlio',
    storyChoice: 'Scrivere una storia',
    workbookChoice: 'Imparare un argomento',
    transformationTitle: 'Dall’idea al libro',
    languageTitle: 'Crea, leggi e ascolta in 20 lingue.',
    finalTitle: 'Leggi. Ascolta. Scarica. Condividi.',
    finalBody: 'I tuoi libri sono con te sul dispositivo, nella biblioteca e nella community.',
    primaryCta: 'Crea il mio primo libro',
    secondaryCta: 'Esplora gli esempi',
    fairyCoverTitle: 'Lila alla ricerca del tempo',
    storyCoverTitle: 'La città dove tacquero gli orologi',
    workbookCoverTitle: 'L’elasticità del tempo'
  },
  ja: {
    heroTitle: 'ひとつのアイデア。命を吹き込まれた一冊。',
    heroBody: 'Fortaleが、あなたのアイデアを絵と音声付きの共有できる本に変えます。',
    prompt: '時間はなぜ、ときどきゆっくり進むの？',
    chooseTitle: '今日は何をつくりますか？',
    fairyChoice: '子どものためのおとぎ話',
    storyChoice: '物語を書く',
    workbookChoice: 'テーマを学ぶ',
    transformationTitle: 'アイデアから本へ',
    languageTitle: '20の言語で、つくる・読む・聴く。',
    finalTitle: '読む。聴く。保存する。分かち合う。',
    finalBody: '本は端末にも、本棚にも、コミュニティにも。いつでもあなたと一緒です。',
    primaryCta: '最初の本をつくる',
    secondaryCta: '作品例を見る',
    fairyCoverTitle: 'リラと時間のゆくえ',
    storyCoverTitle: '時計が沈黙した街',
    workbookCoverTitle: '時間のしなやかさ'
  },
  ko: {
    heroTitle: '하나의 아이디어. 살아나는 한 권의 책.',
    heroBody: 'Fortale가 아이디어를 그림과 음성으로 완성된 공유 가능한 책으로 바꿔 드립니다.',
    prompt: '시간은 왜 가끔 느리게 흐를까요?',
    chooseTitle: '오늘 무엇을 만들고 싶나요?',
    fairyChoice: '아이를 위한 동화',
    storyChoice: '이야기 쓰기',
    workbookChoice: '주제 학습하기',
    transformationTitle: '아이디어에서 책으로',
    languageTitle: '20개 언어로 만들고, 읽고, 들어 보세요.',
    finalTitle: '읽고. 듣고. 내려받고. 나누세요.',
    finalBody: '책은 기기와 서재, 커뮤니티 어디서나 함께합니다.',
    primaryCta: '첫 번째 책 만들기',
    secondaryCta: '예시 둘러보기',
    fairyCoverTitle: '시간을 찾아 나선 릴라',
    storyCoverTitle: '시계가 침묵한 도시',
    workbookCoverTitle: '시간의 탄력성'
  },
  nl: {
    heroTitle: 'Eén idee. Een boek dat leeft.',
    heroBody: 'Fortale verandert je idee in een geïllustreerd, ingesproken en deelbaar boek.',
    prompt: 'Waarom gaat de tijd soms langzamer?',
    chooseTitle: 'Wat wil je vandaag maken?',
    fairyChoice: 'Een sprookje voor mijn kind',
    storyChoice: 'Een verhaal schrijven',
    workbookChoice: 'Een onderwerp leren',
    transformationTitle: 'Van idee naar boek',
    languageTitle: 'Maak, lees en luister in 20 talen.',
    finalTitle: 'Lees. Luister. Download. Deel.',
    finalBody: 'Je boeken blijven bij je op je apparaat, in je bibliotheek en in de community.',
    primaryCta: 'Mijn eerste boek maken',
    secondaryCta: 'Voorbeelden bekijken',
    fairyCoverTitle: 'Lila zoekt de tijd',
    storyCoverTitle: 'De stad waar de klokken zwegen',
    workbookCoverTitle: 'De elasticiteit van tijd'
  },
  no: {
    heroTitle: 'Én idé. En levende bok.',
    heroBody: 'Fortale gjør ideen din til en illustrert, innlest og delbar bok.',
    prompt: 'Hvorfor går tiden noen ganger saktere?',
    chooseTitle: 'Hva vil du skape i dag?',
    fairyChoice: 'Et eventyr til barnet mitt',
    storyChoice: 'Skrive en historie',
    workbookChoice: 'Lære et tema',
    transformationTitle: 'Fra idé til bok',
    languageTitle: 'Skap, les og lytt på 20 språk.',
    finalTitle: 'Les. Lytt. Last ned. Del.',
    finalBody: 'Bøkene dine følger deg på enheten, i biblioteket og i fellesskapet.',
    primaryCta: 'Lag min første bok',
    secondaryCta: 'Utforsk eksempler',
    fairyCoverTitle: 'Lila leter etter tiden',
    storyCoverTitle: 'Byen der klokkene stilnet',
    workbookCoverTitle: 'Tidens elastisitet'
  },
  pl: {
    heroTitle: 'Jeden pomysł. Żywa książka.',
    heroBody: 'Fortale zmienia Twój pomysł w ilustrowaną, udźwiękowioną i gotową do udostępnienia książkę.',
    prompt: 'Dlaczego czas czasem płynie wolniej?',
    chooseTitle: 'Co chcesz dziś stworzyć?',
    fairyChoice: 'Baśń dla mojego dziecka',
    storyChoice: 'Napisać historię',
    workbookChoice: 'Poznać wybrany temat',
    transformationTitle: 'Od pomysłu do książki',
    languageTitle: 'Twórz, czytaj i słuchaj w 20 językach.',
    finalTitle: 'Czytaj. Słuchaj. Pobieraj. Udostępniaj.',
    finalBody: 'Twoje książki są z Tobą na urządzeniu, w bibliotece i społeczności.',
    primaryCta: 'Utwórz moją pierwszą książkę',
    secondaryCta: 'Zobacz przykłady',
    fairyCoverTitle: 'Lila w poszukiwaniu czasu',
    storyCoverTitle: 'Miasto, w którym ucichły zegary',
    workbookCoverTitle: 'Elastyczność czasu'
  },
  'pt-BR': {
    heroTitle: 'Uma ideia. Um livro que ganha vida.',
    heroBody: 'O Fortale transforma sua ideia em um livro ilustrado, narrado e pronto para compartilhar.',
    prompt: 'Por que o tempo às vezes passa mais devagar?',
    chooseTitle: 'O que você quer criar hoje?',
    fairyChoice: 'Um conto para meu filho',
    storyChoice: 'Escrever uma história',
    workbookChoice: 'Aprender um assunto',
    transformationTitle: 'Da ideia ao livro',
    languageTitle: 'Crie, leia e ouça em 20 idiomas.',
    finalTitle: 'Leia. Ouça. Baixe. Compartilhe.',
    finalBody: 'Seus livros acompanham você no dispositivo, na biblioteca e na comunidade.',
    primaryCta: 'Criar meu primeiro livro',
    secondaryCta: 'Explorar exemplos',
    fairyCoverTitle: 'Lila em Busca do Tempo',
    storyCoverTitle: 'A Cidade Onde os Relógios Silenciaram',
    workbookCoverTitle: 'A Elasticidade do Tempo'
  },
  sv: {
    heroTitle: 'En idé. En bok som får liv.',
    heroBody: 'Fortale förvandlar din idé till en illustrerad, inläst och delbar bok.',
    prompt: 'Varför går tiden ibland långsammare?',
    chooseTitle: 'Vad vill du skapa idag?',
    fairyChoice: 'En saga till mitt barn',
    storyChoice: 'Skriva en berättelse',
    workbookChoice: 'Lära mig ett ämne',
    transformationTitle: 'Från idé till bok',
    languageTitle: 'Skapa, läs och lyssna på 20 språk.',
    finalTitle: 'Läs. Lyssna. Ladda ner. Dela.',
    finalBody: 'Dina böcker följer dig på enheten, i biblioteket och i communityn.',
    primaryCta: 'Skapa min första bok',
    secondaryCta: 'Utforska exempel',
    fairyCoverTitle: 'Lila söker efter tiden',
    storyCoverTitle: 'Staden där klockorna tystnade',
    workbookCoverTitle: 'Tidens elasticitet'
  },
  th: {
    heroTitle: 'หนึ่งไอเดีย หนังสือที่มีชีวิต',
    heroBody: 'Fortale เปลี่ยนไอเดียของคุณให้เป็นหนังสือภาพพร้อมเสียงที่แบ่งปันได้',
    prompt: 'ทำไมบางครั้งเวลาจึงเดินช้าลง?',
    chooseTitle: 'วันนี้คุณอยากสร้างอะไร?',
    fairyChoice: 'นิทานสำหรับลูกของฉัน',
    storyChoice: 'เขียนเรื่องราว',
    workbookChoice: 'เรียนรู้หัวข้อหนึ่ง',
    transformationTitle: 'จากไอเดียสู่หนังสือ',
    languageTitle: 'สร้าง อ่าน และฟังได้ใน 20 ภาษา',
    finalTitle: 'อ่าน ฟัง ดาวน์โหลด แบ่งปัน',
    finalBody: 'หนังสือของคุณอยู่กับคุณทั้งในอุปกรณ์ ห้องสมุด และชุมชน',
    primaryCta: 'สร้างหนังสือเล่มแรกของฉัน',
    secondaryCta: 'สำรวจตัวอย่าง',
    fairyCoverTitle: 'ไลล่าตามหาเวลา',
    storyCoverTitle: 'เมืองที่นาฬิกาเงียบงัน',
    workbookCoverTitle: 'ความยืดหยุ่นของเวลา'
  },
  tr: {
    heroTitle: 'Bir fikir. Yaşayan bir kitap.',
    heroBody: 'Fortale; fikirleri resimli ve sesli kitaplara, hikâyelere, masallara ve çalışma kitaplarına dönüştüren yapay zekâ destekli yaratıcı bir uygulamadır. Oku, dinle, indir ve paylaş.',
    prompt: 'Zaman neden bazen yavaşlar?',
    chooseTitle: 'Bugün ne oluşturmak istiyorsun?',
    fairyChoice: 'Çocuğum için masal',
    storyChoice: 'Bir hikâye yazmak',
    workbookChoice: 'Bir konuyu öğrenmek',
    transformationTitle: 'Fikirden kitaba',
    languageTitle: '20 dilde üret, oku ve dinle.',
    finalTitle: 'Oku. Dinle. İndir. Paylaş.',
    finalBody: 'Kitapların cihazında, kitaplığında ve toplulukta seninle.',
    primaryCta: 'İlk kitabımı oluştur',
    secondaryCta: 'Örnekleri keşfet',
    fairyCoverTitle: 'Zamanı Arayan Lila',
    storyCoverTitle: 'Saatlerin Susturduğu Şehir',
    workbookCoverTitle: 'Zamanın Esnekliği'
  }
};

export const ONBOARDING_V2_LABELS: Record<AppLanguageCode, OnboardingV2Labels> = {
  ar: {
    idea: 'فكرة', title: 'العنوان', sectionsAndVisuals: 'الفصول والصور', writeYourIdea: 'اكتب فكرتك',
    completeBook: 'فكرة واحدة، كتاب متكامل', youChoose: 'أنت تختار', library: 'المكتبة'
  },
  da: {
    idea: 'Idé', title: 'Titel', sectionsAndVisuals: 'Kapitler og illustrationer', writeYourIdea: 'Skriv din idé',
    completeBook: 'Én idé, en komplet bog', youChoose: 'Du vælger', library: 'Bibliotek'
  },
  de: {
    idea: 'Idee', title: 'Titel', sectionsAndVisuals: 'Kapitel und Bilder', writeYourIdea: 'Schreibe deine Idee',
    completeBook: 'Eine Idee, ein vollständiges Buch', youChoose: 'Du entscheidest', library: 'Bibliothek'
  },
  el: {
    idea: 'Ιδέα', title: 'Τίτλος', sectionsAndVisuals: 'Κεφάλαια και εικόνες', writeYourIdea: 'Γράψε την ιδέα σου',
    completeBook: 'Μία ιδέα, ένα ολοκληρωμένο βιβλίο', youChoose: 'Εσύ επιλέγεις', library: 'Βιβλιοθήκη'
  },
  en: {
    idea: 'Idea', title: 'Title', sectionsAndVisuals: 'Chapters and visuals', writeYourIdea: 'Write your idea',
    completeBook: 'One idea, a complete book', youChoose: 'You choose', library: 'Library'
  },
  es: {
    idea: 'Idea', title: 'Título', sectionsAndVisuals: 'Capítulos e imágenes', writeYourIdea: 'Escribe tu idea',
    completeBook: 'Una idea, un libro completo', youChoose: 'Tú eliges', library: 'Biblioteca'
  },
  fi: {
    idea: 'Idea', title: 'Otsikko', sectionsAndVisuals: 'Luvut ja kuvat', writeYourIdea: 'Kirjoita ideasi',
    completeBook: 'Yksi idea, kokonainen kirja', youChoose: 'Sinä valitset', library: 'Kirjasto'
  },
  fr: {
    idea: 'Idée', title: 'Titre', sectionsAndVisuals: 'Chapitres et images', writeYourIdea: 'Écris ton idée',
    completeBook: 'Une idée, un livre complet', youChoose: 'À toi de choisir', library: 'Bibliothèque'
  },
  hi: {
    idea: 'विचार', title: 'शीर्षक', sectionsAndVisuals: 'अध्याय और चित्र', writeYourIdea: 'अपना विचार लिखें',
    completeBook: 'एक विचार, एक पूरी किताब', youChoose: 'आप चुनें', library: 'लाइब्रेरी'
  },
  id: {
    idea: 'Ide', title: 'Judul', sectionsAndVisuals: 'Bab dan ilustrasi', writeYourIdea: 'Tulis idemu',
    completeBook: 'Satu ide, satu buku lengkap', youChoose: 'Kamu pilih', library: 'Perpustakaan'
  },
  it: {
    idea: 'Idea', title: 'Titolo', sectionsAndVisuals: 'Capitoli e immagini', writeYourIdea: 'Scrivi la tua idea',
    completeBook: 'Un’idea, un libro completo', youChoose: 'Scegli tu', library: 'Biblioteca'
  },
  ja: {
    idea: 'アイデア', title: 'タイトル', sectionsAndVisuals: '章とイラスト', writeYourIdea: 'アイデアを書く',
    completeBook: 'ひとつのアイデアから一冊の本へ', youChoose: 'あなたが選ぶ', library: '本棚'
  },
  ko: {
    idea: '아이디어', title: '제목', sectionsAndVisuals: '챕터와 이미지', writeYourIdea: '아이디어를 적어 보세요',
    completeBook: '하나의 아이디어, 완성된 한 권', youChoose: '직접 선택하세요', library: '서재'
  },
  nl: {
    idea: 'Idee', title: 'Titel', sectionsAndVisuals: 'Hoofdstukken en beelden', writeYourIdea: 'Schrijf je idee',
    completeBook: 'Eén idee, een compleet boek', youChoose: 'Jij kiest', library: 'Bibliotheek'
  },
  no: {
    idea: 'Idé', title: 'Tittel', sectionsAndVisuals: 'Kapitler og illustrasjoner', writeYourIdea: 'Skriv ideen din',
    completeBook: 'Én idé, en komplett bok', youChoose: 'Du velger', library: 'Bibliotek'
  },
  pl: {
    idea: 'Pomysł', title: 'Tytuł', sectionsAndVisuals: 'Rozdziały i ilustracje', writeYourIdea: 'Napisz swój pomysł',
    completeBook: 'Jeden pomysł, kompletna książka', youChoose: 'Ty wybierasz', library: 'Biblioteka'
  },
  'pt-BR': {
    idea: 'Ideia', title: 'Título', sectionsAndVisuals: 'Capítulos e imagens', writeYourIdea: 'Escreva sua ideia',
    completeBook: 'Uma ideia, um livro completo', youChoose: 'Você escolhe', library: 'Biblioteca'
  },
  sv: {
    idea: 'Idé', title: 'Titel', sectionsAndVisuals: 'Kapitel och bilder', writeYourIdea: 'Skriv din idé',
    completeBook: 'En idé, en komplett bok', youChoose: 'Du väljer', library: 'Bibliotek'
  },
  th: {
    idea: 'ไอเดีย', title: 'ชื่อเรื่อง', sectionsAndVisuals: 'บทและภาพประกอบ', writeYourIdea: 'เขียนไอเดียของคุณ',
    completeBook: 'หนึ่งไอเดีย หนังสือครบสมบูรณ์', youChoose: 'คุณเลือก', library: 'ห้องสมุด'
  },
  tr: {
    idea: 'Fikir', title: 'Başlık', sectionsAndVisuals: 'Bölümler ve görseller', writeYourIdea: 'Fikrini yaz',
    completeBook: 'Tek fikir, eksiksiz kitap', youChoose: 'Sen seç', library: 'Kitaplık'
  }
};
