// Disegna su <canvas> la card descritta da layoutShareCard (shareCard.js).

const FONT_FAMILY = "Lexend, 'Roboto Condensed', sans-serif";

const makeFill = (ctx, fill) => {
  if (typeof fill === 'string') return fill;
  const { x0, y0, x1, y1, stops } = fill.gradient;
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  return gradient;
};

const roundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Ritaglia la foto al centro perché riempia il riquadro (come object-fit: cover).
const drawCover = (ctx, image, x, y, w, h) => {
  const iw = image.width;
  const ih = image.height;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
};

/**
 * I font del sito si scaricano solo quando servono: senza attendere, il primo
 * disegno userebbe il font di riserva.
 */
export const loadCardFonts = () => {
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.all([
    document.fonts.load('800 100px Lexend'),
    document.fonts.load('500 100px Lexend'),
  ]).catch(() => {});
};

export const renderCardToCanvas = (canvas, layout, photo) => {
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  layout.elements.forEach((el) => {
    if (el.type === 'rect') {
      ctx.fillStyle = makeFill(ctx, el.fill);
      if (el.r) {
        roundedRect(ctx, el.x, el.y, el.w, el.h, el.r);
        ctx.fill();
      } else {
        ctx.fillRect(el.x, el.y, el.w, el.h);
      }
    } else if (el.type === 'photo') {
      if (photo) drawCover(ctx, photo, el.x, el.y, el.w, el.h);
    } else if (el.type === 'text') {
      ctx.font = `${el.weight} ${el.size}px ${FONT_FAMILY}`;
      ctx.fillStyle = el.color;
      ctx.textAlign = el.align;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${el.letterSpacing}px`;
      ctx.fillText(el.text, el.x, el.y);
    }
  });
};

export const canvasToPngFile = (canvas, name) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) reject(new Error('Impossibile creare l\'immagine'));
    else resolve(new File([blob], name, { type: 'image/png' }));
  }, 'image/png');
});

/**
 * Legge la foto scelta dall'utente e la riduce: oltre 1600 px non serve e i
 * telefoni scattano a 12+ megapixel. createImageBitmap applica l'orientamento EXIF.
 */
const loadImageElement = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto non leggibile')); };
  img.src = url;
});

export const loadPhoto = async (file) => {
  const MAX_SIDE = 1600;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Browser senza createImageBitmap con opzioni: <img> applica comunque l'EXIF
    return loadImageElement(file);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) return bitmap;
  const resized = await createImageBitmap(bitmap, {
    resizeWidth: Math.round(bitmap.width * scale),
    resizeHeight: Math.round(bitmap.height * scale),
    resizeQuality: 'high',
  });
  bitmap.close();
  return resized;
};
