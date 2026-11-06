// PROTOTIPO (da buttare): screenshot di /login e /register per le varianti A/B/C della posizione dei pulsanti social
import { chromium } from 'playwright';
const base = `http://localhost:${process.argv[2] || 5207}`;
const out = '/out';
const browser = await chromium.launch();
const shots = [];
for (const theme of ['light', 'dark']) for (const w of [390, 1440]) for (const p of ['login', 'register']) for (const v of ['A', 'B', 'C']) shots.push([p, w, v, theme, false]);
shots.push(['login', 390, 'C', 'light', true], ['register', 390, 'C', 'light', true]);
for (const [p, w, v, theme, open] of shots) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, colorScheme: theme, locale: 'it-IT', reducedMotion: 'reduce', deviceScaleFactor: w === 390 ? 2 : 1 });
  await ctx.addInitScript((mode) => { localStorage.setItem('themeMode', mode); localStorage.setItem('lx_locale', 'it'); localStorage.setItem('lx_lang_choice', 'it'); localStorage.removeItem('isLoggedIn'); }, theme);
  await ctx.route('**/backend/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));
  await ctx.route(/umami|analytics/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`${base}/${p}?variant=${v}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}[data-prototype-switcher]{display:none!important}' });
  if (open) await page.getByRole('button', { name: /con email/ }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const name = `${p}-${w}-${theme}-${v}${open ? '-aperto' : ''}.png`;
  await page.screenshot({ path: `${out}/${name}` });
  console.log(name);
  await ctx.close();
}
await browser.close();
