import { AnswerItem } from '../types';
import { formatPostmarkDate, getSolarTerm } from './storage';

// 一通を縦長の画像カード（1080×1920）にする。本文は一字も整えない。
const W = 1080;
const H = 1920;
const BG = '#F4EFE6';
const CARD = '#FAF7F0';
const LINE = '#E0D8CB';
const SUMI = '#2B2B2B';
const SUMI_LIGHT = '#6E685E';
const SHU = '#B5443A';

const HAND = '"Zen Kurenaido", "Hiragino Sans", sans-serif';
const MINCHO = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif';
const GOTHIC = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';

// 日本語は文字単位で折り返す（禁則は最小限: 行頭の句読点だけ前行に送る）
function wrapJa(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    if (para === '') {
      lines.push('');
      continue;
    }
    let line = '';
    for (const ch of Array.from(para)) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line !== '') {
        if ('、。」』）!?！？'.includes(ch)) {
          lines.push(line + ch);
          line = '';
        } else {
          lines.push(line);
          line = ch;
        }
      } else {
        line = test;
      }
    }
    if (line !== '') lines.push(line);
  }
  return lines;
}

async function ensureFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`400 56px "Zen Kurenaido"`),
      document.fonts.load(`400 40px "Shippori Mincho"`),
      document.fonts.load(`400 28px "Zen Kaku Gothic New"`),
    ]);
  } catch {
    // フォントが無くても描く
  }
}

export async function renderAnswerCard(answer: AnswerItem): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 背景（紙）
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(43,43,43,0.035)';
  for (let y = 0; y < H; y += 40) {
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 封筒（カード）
  const pad = 72;
  const cardX = pad;
  const cardY = 160;
  const cardW = W - pad * 2;
  const cardH = H - cardY - 150;
  ctx.fillStyle = CARD;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fill();
  ctx.stroke();

  // 封筒の斜線
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX, cardY + cardH);
  ctx.lineTo(cardX + cardW * 0.4, cardY + cardH - 260);
  ctx.moveTo(cardX + cardW, cardY + cardH);
  ctx.lineTo(cardX + cardW * 0.6, cardY + cardH - 260);
  ctx.stroke();

  // 消印（右上）
  const pmX = cardX + cardW - 120;
  const pmY = cardY + 120;
  ctx.strokeStyle = SUMI;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pmX, pmY, 72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pmX - 40, pmY);
  ctx.lineTo(pmX + 40, pmY);
  ctx.stroke();
  ctx.fillStyle = SUMI;
  ctx.textAlign = 'center';
  ctx.font = `500 26px ${GOTHIC}`;
  ctx.fillText(formatPostmarkDate(answer.date), pmX, pmY - 18);
  ctx.font = `400 30px ${MINCHO}`;
  ctx.fillText(getSolarTerm(answer.date), pmX, pmY + 40);

  // 差出・宛先
  ctx.textAlign = 'left';
  ctx.fillStyle = SUMI_LIGHT;
  ctx.font = `400 28px ${GOTHIC}`;
  ctx.fillText(`${answer.recipientName} へ`, cardX + 64, cardY + 110);

  // 問い（手書き体）
  let y = cardY + 300; // 消印（右上）に重ならない高さから
  ctx.fillStyle = SUMI;
  ctx.font = `400 56px ${HAND}`;
  const qLines = wrapJa(ctx, answer.textForRecipient || answer.questionText, cardW - 128);
  for (const l of qLines.slice(0, 5)) {
    ctx.fillText(l, cardX + 64, y);
    y += 80;
  }

  // 区切り線
  y += 10;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(cardX + 64, y);
  ctx.lineTo(cardX + cardW - 64, y);
  ctx.stroke();
  y += 80;

  // 本文（明朝。そのまま）
  ctx.fillStyle = SUMI;
  ctx.font = `400 40px ${MINCHO}`;
  const bodyLines = wrapJa(ctx, answer.text, cardW - 128);
  const maxBodyY = cardY + cardH - 200;
  let truncated = false;
  for (const l of bodyLines) {
    if (y > maxBodyY) {
      truncated = true;
      break;
    }
    ctx.fillText(l, cardX + 64, y);
    y += 66;
  }
  if (truncated) {
    ctx.fillStyle = SUMI_LIGHT;
    ctx.font = `400 28px ${GOTHIC}`;
    ctx.fillText('（つづきは手紙で）', cardX + 64, y);
  }

  // 封緘（朱の点）
  const sealX = cardX + cardW / 2;
  const sealY = cardY + cardH - 90;
  ctx.fillStyle = SHU;
  ctx.beginPath();
  ctx.arc(sealX, sealY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SHU;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sealX - 70, sealY + 26);
  ctx.quadraticCurveTo(sealX, sealY - 10, sealX + 70, sealY + 26);
  ctx.stroke();

  // 署名・ロゴ
  ctx.textAlign = 'right';
  ctx.fillStyle = SUMI_LIGHT;
  ctx.font = `400 30px ${HAND}`;
  ctx.fillText('わたしより', cardX + cardW - 64, cardY + cardH - 150);
  ctx.textAlign = 'center';
  ctx.fillStyle = SUMI_LIGHT;
  ctx.font = `500 28px ${MINCHO}`;
  ctx.fillText('NOCOSU', W / 2, H - 70);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を作れませんでした'))), 'image/png');
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 画像を共有（対応端末）または保存する */
export async function shareOrDownloadAnswerCard(answer: AnswerItem): Promise<'shared' | 'downloaded'> {
  const blob = await renderAnswerCard(answer);
  const file = new File([blob], `nocosu_${answer.date}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'NOCOSU' });
      return 'shared';
    } catch {
      // キャンセル時は保存に落とす
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
}
