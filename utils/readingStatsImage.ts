import type { ReadingStats } from './readingProgressModel';
export function favorite(values: Record<string,number>) { return Object.entries(values).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'Henüz yok'; }
export async function createReadingStatsImage(stats: ReadingStats): Promise<Blob> {
  const canvas=document.createElement('canvas'); canvas.width=1200; canvas.height=1500;
  const c=canvas.getContext('2d')!;
  const round=(x:number,y:number,w:number,h:number,r:number,color:string) => { c.fillStyle=color; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill(); };
  c.fillStyle='#f7f2ea';c.fillRect(0,0,1200,1500);
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
  round(90,120,1020,1220,65,'#fffcf5');c.shadowBlur=0;c.shadowOffsetY=0;
  c.strokeStyle='#e6dac7';c.lineWidth=4;c.stroke();
  const text=(value:string,x:number,y:number,size:number,color='#403329',weight=600) => { c.fillStyle=color;c.font=`${weight} ${size}px system-ui, sans-serif`;c.textAlign='center';c.fillText(value,x,y,900); };
  text('Okuma Hatıram',600,250,58);
  text(String(stats.total),600,445,138,'#c04235',700);text('kitap bitirdim',600,515,34);
  const columns=[['Masal',stats.types.fairy_tale || 0],['Hikaye',stats.types.novel || 0],['Çalışma kitabı',stats.types.story || 0]];
  columns.forEach(([label,value],index)=>{ const x=300+index*300; text(String(value),x,665,62,'#c04235');text(String(label),x,720,28); });
  text(`Bu ay ${stats.month} kitap bitirdim`,600,835,34);
  text('En sevdiğim tür',600,945,26,'#827465',500);text(favorite(stats.genres),600,1000,36);
  text('En sevdiğim alt tür',600,1095,26,'#827465',500);text(favorite(stats.subGenres),600,1150,36);
  text('Fortale • Her kitap yeni bir dünya',420,1436,27,'#827465',500);
  avatar(920,1260,.95);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG oluşturulamadı')),'image/png'));
}
