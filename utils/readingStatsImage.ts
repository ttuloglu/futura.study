import { getLocalizedLanguageName } from '../data/appLanguages';
import type { ReadingStats } from './readingProgressModel';
import { getCompanionAvatar } from './companionAvatar';
import { companionAvatar } from '../data/companionAvatars';
export function favorite(values: Record<string,number>) { return Object.entries(values).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'Henüz yok'; }
export function readingLanguageName(code: string, locale: string) {
  if (locale.toLowerCase().startsWith('tr')) return getLocalizedLanguageName(code,locale);
  try { return new Intl.DisplayNames([locale], { type: 'language' }).of(code) || code; }
  catch { return getLocalizedLanguageName(code,locale); }
}
export async function createReadingStatsImage(stats: ReadingStats, t: (text:string) => string = text => text, locale = 'tr'): Promise<Blob> {
  const selected=companionAvatar(getCompanionAvatar().selected);
  const sprite=selected.id === 'dost' ? null : await new Promise<HTMLImageElement | null>(resolve=>{
    const img=new Image(); img.onload=()=>resolve(img);img.onerror=()=>resolve(null); img.src=`/companions/${selected.id}-v1.png`;
  });
  const languages=Object.entries(stats.learning.languages).sort((a,b)=>b[1]-a[1]);
  const canvas=document.createElement('canvas'); canvas.width=1200; canvas.height=1500+Math.ceil(languages.length/2)*65;
  const c=canvas.getContext('2d')!;
  const round=(x:number,y:number,w:number,h:number,r:number,color:string) => { c.fillStyle=color; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill(); };
  c.fillStyle='#22272d';c.fillRect(0,0,1200,canvas.height);
  // Same cream body, red tuft, eyes and raised hands as the app companion.
  const avatar=(x:number,y:number,s:number) => {
    c.save();c.translate(x,y);c.scale(s,s);
    c.shadowColor='#49322325';c.shadowBlur=20;c.shadowOffsetY=9;
    round(10,22,160,160,70,'#fffaf1');c.shadowBlur=0;c.shadowOffsetY=0;
    c.fillStyle='#c04235';c.beginPath();c.moveTo(85,29);c.bezierCurveTo(81,12,100,3,113,4);c.bezierCurveTo(114,19,103,31,85,29);c.fill();
    c.fillStyle='#efb4a560';for(const x of [43,135]){c.beginPath();c.ellipse(x,108,11,5,0,0,Math.PI*2);c.fill();}
    for (const x of [61,117]) { c.fillStyle='#33333a';c.beginPath();c.ellipse(x,92,6,8,0,0,Math.PI*2);c.fill();c.fillStyle='white';c.beginPath();c.arc(x-1,90,2,0,Math.PI*2);c.fill(); }
    c.strokeStyle='#33333a';c.lineWidth=3;c.beginPath();c.arc(89,111,10,.15,Math.PI-.15);c.stroke();
    round(0,91,23,47,12,'#fffaf1');round(157,91,23,47,12,'#fffaf1');
    round(32,174,37,20,13,'#f1e8d8');round(108,174,37,20,13,'#f1e8d8');c.restore();
  };
  c.shadowColor='#46322618';c.shadowBlur=45;c.shadowOffsetY=18;
  round(90,120,1020,canvas.height-280,40,'#303337');c.shadowBlur=0;c.shadowOffsetY=0;
  c.strokeStyle='#dad3c625';c.lineWidth=4;c.stroke();
  const text=(value:string,x:number,y:number,size:number,color='#dad3c6',weight=600) => { c.fillStyle=color;c.font=`${weight} ${size}px system-ui, sans-serif`;c.textAlign='center';c.fillText(value,x,y,900); };
  text(t('Okuma istatistikleri'),600,250,48);
  text(String(stats.total),600,415,120,'#e0a394',500);text(t('Bitirilen kitap'),600,475,28);
  text(`${t('Bu ay')}  ${stats.month}     ·     ${t('Devam edilen')}  ${stats.inProgress}`,600,555,28);
  const columns=[['Hikaye',stats.types.novel || 0],['Masal',stats.types.fairy_tale || 0],['Çalışma kitabı',stats.types.story || 0],['Yabancı dil',stats.learning.total]];
  columns.forEach(([label,value],index)=>{ const x=240+index*240; text(String(value),x,690,48,'#dad3c6');text(t(String(label)),x,740,24); });
  text(t('Yabancı dilde okuma'),600,870,32);
  if (!languages.length) text(t('Bitirdiğin yabancı dil kitapları burada görünecek.'),600,940,24,'#aaa59d',400);
  languages.forEach(([code,count],index)=>text(`${readingLanguageName(code,locale)}  ·  ${count}`,index%2 ? 810 : 390,940+Math.floor(index/2)*65,28));
  const offset=Math.ceil(languages.length/2)*65;
  const levels=Object.entries(stats.learning.levels).sort((a,b)=>a[0].localeCompare(b[0])).map(([level,count])=>`${level} · ${count}`).join('     ');
  if(levels) text(`${t('Kitap seviyeleri')}  ${levels}`,600,1005+offset,24,'#aaa59d',400);
  text(`${t('En sevdiğim tür')}  ·  ${t(favorite(stats.genres))}`,600,1120+offset,28);
  text(`${t('En sevdiğim alt tür')}  ·  ${t(favorite(stats.subGenres))}`,600,1180+offset,28);
  text('Fortale',260,canvas.height-68,30,'#aaa59d',500);
  if(sprite) {
    c.drawImage(sprite,920,canvas.height-230,180,180);
  } else avatar(920,canvas.height-230,.85);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG oluşturulamadı')),'image/png'));
}
