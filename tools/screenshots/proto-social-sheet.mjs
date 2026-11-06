// PROTOTIPO (da buttare): fogli di confronto A | B | C dagli screenshot di proto-social.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const dir = '/out';
const img = (f) => `data:image/png;base64,${readFileSync(`${dir}/${f}`).toString('base64')}`;
const names = { A: 'A · modulo prima', B: 'B · social prima', C: 'C · solo pulsanti' };
const sheets = [];
for (const p of ['login', 'register']) for (const w of [390, 1440]) sheets.push({ p, w });
const browser = await chromium.launch();
for (const { p, w } of sheets) {
  const cols = ['A', 'B', 'C'];
  const colW = w === 390 ? 300 : 620;
  const rows = ['light', 'dark'].map((t) => `<div class="row"><div class="lbl">${t === 'light' ? 'chiaro' : 'scuro'}</div>${cols.map((v) => `<figure><img src="${img(`${p}-${w}-${t}-${v}.png`)}"></figure>`).join('')}</div>`).join('');
  const head = `<div class="row head"><div class="lbl"></div>${cols.map((v) => `<h2>${names[v]}</h2>`).join('')}</div>`;
  const extra = w === 390 ? `<div class="row"><div class="lbl">C dopo il tocco su «con email»</div><figure></figure><figure></figure><figure><img src="${img(`${p}-390-light-C-aperto.png`)}"></figure></div>` : '';
  const html = `<html><body style="margin:0;font-family:sans-serif;background:#ddd"><style>.row{display:flex;gap:16px;padding:8px 16px;align-items:flex-start}.lbl{width:70px;font-size:14px;padding-top:8px}figure{margin:0;width:${colW}px}img{width:100%;border:1px solid #999;display:block}h2{width:${colW}px;margin:8px 0;font-size:20px}</style><h1 style="padding:8px 16px;margin:0;font-size:22px">${p === 'login' ? 'Accedi' : 'Registrati (passo 1)'} · ${w}px</h1>${head}${rows}${extra}</body></html>`;
  const page = await browser.newPage({ viewport: { width: 120 + 3 * (colW + 16), height: 800 } });
  await page.setContent(html);
  await page.screenshot({ path: `${dir}/confronto-${p}-${w}.png`, fullPage: true });
  await page.close();
  console.log(`confronto-${p}-${w}.png`);
}
await browser.close();
