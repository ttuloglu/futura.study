import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

const globalOpts = pdfFonts as any;
const resolvedVfs =
    globalOpts?.pdfMake?.vfs ||
    globalOpts?.default?.pdfMake?.vfs ||
    globalOpts?.vfs;

(pdfMake as any).vfs = resolvedVfs;

export default pdfMake;
