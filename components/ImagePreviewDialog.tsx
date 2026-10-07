import React, { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Zoom } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/zoom';
import FloatIslandSheet from './FloatIslandSheet';
import FaviconSpinner from './FaviconSpinner';
import { useUiI18n } from '../i18n/uiI18n';
import { prepareImageShare, shareImageFile } from '../utils/imageShare';

export default function ImagePreviewDialog({ image, onClose }: {
  image: { src: string; title: string } | null;
  onClose: () => void;
}) {
  const { t } = useUiI18n();
  const [prepared, setPrepared] = useState<{ src: string; file: File } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setPrepared(null); setError('');
    if (!image) return;
    const abort = new AbortController();
    void prepareImageShare(image.src, image.title, abort.signal).then(file => {
      if (!abort.signal.aborted) setPrepared({ src: image.src, file });
    }).catch(() => { if (!abort.signal.aborted) setError(t('Görsel paylaşılamadı.')); });
    return () => abort.abort();
  }, [image?.src, image?.title, t]);
  const share = async () => {
    if (!image || sharing || prepared?.src !== image.src) return;
    setSharing(true); setError('');
    try { await shareImageFile(prepared.file, image.title); }
    catch (reason) { if ((reason as Error)?.name !== 'AbortError') setError(t('Görsel paylaşılamadı.')); }
    finally { setSharing(false); }
  };
  return <FloatIslandSheet isOpen={Boolean(image)} onClose={onClose} title={image?.title || t('Kapak Görseli')}
    layer={1200} maxWidth="100%" panelClassName="fortale-cover-preview-sheet"
    headerActions={<button type="button" className="fortale-image-share" aria-label={t('Paylaş')} title={t('Paylaş')}
      disabled={prepared?.src !== image?.src || sharing} onClick={() => void share()}>
      {sharing ? <FaviconSpinner size={18}/> : <Share2 size={20}/>}
    </button>}
    footer={error ? <p role="alert" className="text-center text-xs text-white/70">{error}</p> : undefined}>
    {image && <Swiper key={image.src} modules={[Zoom]} zoom={{ maxRatio: 3 }} slidesPerView={1}
      className="fortale-image-viewer" allowTouchMove={false}>
      <SwiperSlide><div className="swiper-zoom-container">
        <img src={image.src} alt={image.title} className="fortale-cover-preview-image"/>
      </div></SwiperSlide>
    </Swiper>}
  </FloatIslandSheet>;
}
