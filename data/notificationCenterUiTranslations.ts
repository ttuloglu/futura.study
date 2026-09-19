import type { AppLanguageCode } from './appLanguages';

type NotificationCenterTranslationKey =
  | 'Bildirimler'
  | 'Yeni bildirimleri ve kitap güncellemelerini burada gör.'
  | 'Tümünü temizle'
  | 'Henüz bildirim yok'
  | 'Kitabın hazır olduğunda bildirimin burada görünecek.'
  | 'okunmamış'
  | 'Bildirimleri aç'
  | 'Bildirim geçmişini temizle';

export const NOTIFICATION_CENTER_UI_TRANSLATIONS: Record<
  AppLanguageCode,
  Record<NotificationCenterTranslationKey, string>
> = {
  ar: {
    'Bildirimler': 'الإشعارات',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'اعرض الإشعارات الجديدة وتحديثات الكتب هنا.',
    'Tümünü temizle': 'مسح الكل',
    'Henüz bildirim yok': 'لا توجد إشعارات بعد',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'سيظهر الإشعار هنا عندما يصبح كتابك جاهزًا.',
    'okunmamış': 'غير مقروء',
    'Bildirimleri aç': 'فتح الإشعارات',
    'Bildirim geçmişini temizle': 'مسح سجل الإشعارات'
  },
  da: {
    'Bildirimler': 'Notifikationer',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Se nye notifikationer og bogopdateringer her.',
    'Tümünü temizle': 'Ryd alle',
    'Henüz bildirim yok': 'Ingen notifikationer endnu',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Din notifikation vises her, når din bog er klar.',
    'okunmamış': 'ulæste',
    'Bildirimleri aç': 'Åbn notifikationer',
    'Bildirim geçmişini temizle': 'Ryd notifikationshistorik'
  },
  de: {
    'Bildirimler': 'Mitteilungen',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Hier siehst du neue Mitteilungen und Buchaktualisierungen.',
    'Tümünü temizle': 'Alle löschen',
    'Henüz bildirim yok': 'Noch keine Mitteilungen',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Sobald dein Buch fertig ist, erscheint die Mitteilung hier.',
    'okunmamış': 'ungelesen',
    'Bildirimleri aç': 'Mitteilungen öffnen',
    'Bildirim geçmişini temizle': 'Mitteilungsverlauf löschen'
  },
  el: {
    'Bildirimler': 'Ειδοποιήσεις',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Δες εδώ νέες ειδοποιήσεις και ενημερώσεις βιβλίων.',
    'Tümünü temizle': 'Εκκαθάριση όλων',
    'Henüz bildirim yok': 'Δεν υπάρχουν ειδοποιήσεις ακόμη',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Η ειδοποίηση θα εμφανιστεί εδώ όταν το βιβλίο σου είναι έτοιμο.',
    'okunmamış': 'μη αναγνωσμένες',
    'Bildirimleri aç': 'Άνοιγμα ειδοποιήσεων',
    'Bildirim geçmişini temizle': 'Εκκαθάριση ιστορικού ειδοποιήσεων'
  },
  en: {
    'Bildirimler': 'Notifications',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'See new notifications and book updates here.',
    'Tümünü temizle': 'Clear all',
    'Henüz bildirim yok': 'No notifications yet',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Your notification will appear here when your book is ready.',
    'okunmamış': 'unread',
    'Bildirimleri aç': 'Open notifications',
    'Bildirim geçmişini temizle': 'Clear notification history'
  },
  es: {
    'Bildirimler': 'Notificaciones',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Consulta aquí las nuevas notificaciones y actualizaciones de libros.',
    'Tümünü temizle': 'Borrar todo',
    'Henüz bildirim yok': 'Aún no hay notificaciones',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'La notificación aparecerá aquí cuando tu libro esté listo.',
    'okunmamış': 'sin leer',
    'Bildirimleri aç': 'Abrir notificaciones',
    'Bildirim geçmişini temizle': 'Borrar historial de notificaciones'
  },
  fi: {
    'Bildirimler': 'Ilmoitukset',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Näet uudet ilmoitukset ja kirjapäivitykset täällä.',
    'Tümünü temizle': 'Tyhjennä kaikki',
    'Henüz bildirim yok': 'Ei ilmoituksia vielä',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Ilmoitus näkyy täällä, kun kirjasi on valmis.',
    'okunmamış': 'lukematta',
    'Bildirimleri aç': 'Avaa ilmoitukset',
    'Bildirim geçmişini temizle': 'Tyhjennä ilmoitushistoria'
  },
  fr: {
    'Bildirimler': 'Notifications',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Retrouve ici les nouvelles notifications et les mises à jour de livres.',
    'Tümünü temizle': 'Tout effacer',
    'Henüz bildirim yok': 'Aucune notification pour le moment',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Ta notification apparaîtra ici lorsque ton livre sera prêt.',
    'okunmamış': 'non lues',
    'Bildirimleri aç': 'Ouvrir les notifications',
    'Bildirim geçmişini temizle': 'Effacer l’historique des notifications'
  },
  hi: {
    'Bildirimler': 'सूचनाएँ',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'नई सूचनाएँ और किताब के अपडेट यहाँ देखें।',
    'Tümünü temizle': 'सभी साफ़ करें',
    'Henüz bildirim yok': 'अभी कोई सूचना नहीं है',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'आपकी किताब तैयार होने पर सूचना यहाँ दिखाई देगी।',
    'okunmamış': 'अपठित',
    'Bildirimleri aç': 'सूचनाएँ खोलें',
    'Bildirim geçmişini temizle': 'सूचना इतिहास साफ़ करें'
  },
  id: {
    'Bildirimler': 'Notifikasi',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Lihat notifikasi baru dan pembaruan buku di sini.',
    'Tümünü temizle': 'Hapus semua',
    'Henüz bildirim yok': 'Belum ada notifikasi',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Notifikasi akan muncul di sini saat bukumu siap.',
    'okunmamış': 'belum dibaca',
    'Bildirimleri aç': 'Buka notifikasi',
    'Bildirim geçmişini temizle': 'Hapus riwayat notifikasi'
  },
  it: {
    'Bildirimler': 'Notifiche',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Visualizza qui le nuove notifiche e gli aggiornamenti dei libri.',
    'Tümünü temizle': 'Cancella tutto',
    'Henüz bildirim yok': 'Nessuna notifica',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'La notifica apparirà qui quando il tuo libro sarà pronto.',
    'okunmamış': 'non lette',
    'Bildirimleri aç': 'Apri notifiche',
    'Bildirim geçmişini temizle': 'Cancella cronologia notifiche'
  },
  ja: {
    'Bildirimler': '通知',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': '新しい通知や本の更新をここで確認できます。',
    'Tümünü temizle': 'すべて消去',
    'Henüz bildirim yok': '通知はまだありません',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': '本が完成すると、ここに通知が表示されます。',
    'okunmamış': '未読',
    'Bildirimleri aç': '通知を開く',
    'Bildirim geçmişini temizle': '通知履歴を消去'
  },
  ko: {
    'Bildirimler': '알림',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': '새 알림과 책 업데이트를 여기에서 확인하세요.',
    'Tümünü temizle': '모두 지우기',
    'Henüz bildirim yok': '아직 알림이 없습니다',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': '책이 준비되면 여기에 알림이 표시됩니다.',
    'okunmamış': '읽지 않음',
    'Bildirimleri aç': '알림 열기',
    'Bildirim geçmişini temizle': '알림 기록 지우기'
  },
  nl: {
    'Bildirimler': 'Meldingen',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Bekijk hier nieuwe meldingen en boekupdates.',
    'Tümünü temizle': 'Alles wissen',
    'Henüz bildirim yok': 'Nog geen meldingen',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Je melding verschijnt hier wanneer je boek klaar is.',
    'okunmamış': 'ongelezen',
    'Bildirimleri aç': 'Meldingen openen',
    'Bildirim geçmişini temizle': 'Meldingsgeschiedenis wissen'
  },
  no: {
    'Bildirimler': 'Varsler',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Se nye varsler og bokoppdateringer her.',
    'Tümünü temizle': 'Tøm alle',
    'Henüz bildirim yok': 'Ingen varsler ennå',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Varselet vises her når boken din er klar.',
    'okunmamış': 'uleste',
    'Bildirimleri aç': 'Åpne varsler',
    'Bildirim geçmişini temizle': 'Tøm varselhistorikken'
  },
  pl: {
    'Bildirimler': 'Powiadomienia',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Tutaj znajdziesz nowe powiadomienia i aktualizacje książek.',
    'Tümünü temizle': 'Wyczyść wszystko',
    'Henüz bildirim yok': 'Brak powiadomień',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Powiadomienie pojawi się tutaj, gdy książka będzie gotowa.',
    'okunmamış': 'nieprzeczytane',
    'Bildirimleri aç': 'Otwórz powiadomienia',
    'Bildirim geçmişini temizle': 'Wyczyść historię powiadomień'
  },
  'pt-BR': {
    'Bildirimler': 'Notificações',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Veja aqui novas notificações e atualizações dos livros.',
    'Tümünü temizle': 'Limpar tudo',
    'Henüz bildirim yok': 'Nenhuma notificação ainda',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'A notificação aparecerá aqui quando seu livro estiver pronto.',
    'okunmamış': 'não lidas',
    'Bildirimleri aç': 'Abrir notificações',
    'Bildirim geçmişini temizle': 'Limpar histórico de notificações'
  },
  sv: {
    'Bildirimler': 'Notiser',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Se nya notiser och bokuppdateringar här.',
    'Tümünü temizle': 'Rensa alla',
    'Henüz bildirim yok': 'Inga notiser än',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Notisen visas här när din bok är klar.',
    'okunmamış': 'olästa',
    'Bildirimleri aç': 'Öppna notiser',
    'Bildirim geçmişini temizle': 'Rensa notishistorik'
  },
  th: {
    'Bildirimler': 'การแจ้งเตือน',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'ดูการแจ้งเตือนใหม่และอัปเดตหนังสือได้ที่นี่',
    'Tümünü temizle': 'ล้างทั้งหมด',
    'Henüz bildirim yok': 'ยังไม่มีการแจ้งเตือน',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'การแจ้งเตือนจะแสดงที่นี่เมื่อหนังสือของคุณพร้อมแล้ว',
    'okunmamış': 'ยังไม่ได้อ่าน',
    'Bildirimleri aç': 'เปิดการแจ้งเตือน',
    'Bildirim geçmişini temizle': 'ล้างประวัติการแจ้งเตือน'
  },
  tr: {
    'Bildirimler': 'Bildirimler',
    'Yeni bildirimleri ve kitap güncellemelerini burada gör.': 'Yeni bildirimleri ve kitap güncellemelerini burada gör.',
    'Tümünü temizle': 'Tümünü temizle',
    'Henüz bildirim yok': 'Henüz bildirim yok',
    'Kitabın hazır olduğunda bildirimin burada görünecek.': 'Kitabın hazır olduğunda bildirimin burada görünecek.',
    'okunmamış': 'okunmamış',
    'Bildirimleri aç': 'Bildirimleri aç',
    'Bildirim geçmişini temizle': 'Bildirim geçmişini temizle'
  }
};
