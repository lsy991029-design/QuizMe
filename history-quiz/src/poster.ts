import QRCode from 'qrcode';
import { findCharacter, PRODUCT_NAME, type PublicResult } from './quiz';
import { loadPortrait } from './portraits';

const serif = '"Songti SC", "STSong", "Noto Serif SC", serif';
const sans = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
export async function createPoster(result: PublicResult, shareUrl: string): Promise<Blob> {
  const person = findCharacter(result.personId);
  if (!person) throw new Error('没有找到对应人物，请返回结果页重试。');
  const [portrait] = await Promise.all([loadPortrait(person, 'poster'), document.fonts.ready]);
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持生成人物卡，请尝试其他浏览器。');
  const colors = { paper: '#F6F3EC', ink: '#252722', red: '#A63D32', muted: '#64675F', line: '#DED9CF' };
  ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, 1080, 1440);
  const text = (value: string, x: number, y: number, size: number, color = colors.ink, family = sans, weight = '400') => {
    ctx.font = `${weight} ${size}px ${family}`; ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const line = (y: number) => { ctx.beginPath(); ctx.moveTo(80, y); ctx.lineTo(1000, y); ctx.strokeStyle = colors.line; ctx.lineWidth = 2; ctx.stroke(); };
  const wrap = (value: string, x: number, y: number, size: number, maxWidth: number, lineHeight: number, color = colors.ink) => {
    let current = '';
    for (const char of value) {
      ctx.font = `400 ${size}px ${sans}`;
      if (current && ctx.measureText(current + char).width > maxWidth) { text(current, x, y, size, color); current = char; y += lineHeight; }
      else current += char;
    }
    if (current) text(current, x, y, size, color);
    return y;
  };
  text(PRODUCT_NAME, 80, 94, 38, colors.ink, serif, '700');
  text('跨越时代，遇见同频的自己', 706, 91, 22, colors.muted);
  line(130);
  text('我的历史人物匹配结果是', 80, 191, 27, colors.red);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(portrait, 80, 207, 920, 690);
  ctx.restore();
  text(person.name, 80, 970, person.name.length > 3 ? 82 : 96, colors.ink, serif, '700');
  if (result.matchPercent !== undefined) {
    ctx.textAlign = 'right';
    text(`${result.matchPercent}%`, 1000, 956, 88, colors.red, sans, '700');
    text('同频指数', 995, 993, 23, colors.muted);
    ctx.textAlign = 'left';
  }
  text(person.typeTitle, 80, 1033, 34, colors.red, serif, '600');
  const era = person.era.includes('，') ? person.era.split('，')[0] : person.era;
  text(`${era}  /  ${person.field}`, 80, 1075, 24, colors.muted);
  text(person.tags.join('   ·   '), 80, 1121, 27);
  line(1160);
  text('你会与谁同频？', 80, 1225, 36, colors.ink, serif, '600');
  wrap(person.shareText, 80, 1272, 23, 610, 34, colors.muted);
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, shareUrl, { width: 240, margin: 4, errorCorrectionLevel: 'M', color: { dark: colors.ink, light: colors.paper } });
  ctx.imageSmoothingEnabled = false; ctx.drawImage(qr, 760, 1174, 240, 240);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('人物卡生成失败，请重新生成。')), 'image/png'));
}
