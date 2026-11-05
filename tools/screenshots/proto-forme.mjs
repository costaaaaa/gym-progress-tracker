// PROTOTIPO (da buttare): screenshot di /login e /register per le varianti A/B/C
import { chromium } from 'playwright';
const base = 'http://localhost:5199';
const out = '/out';
const browser = await chromium.launch();
const shots = [];
for (const v of ['A', 'B', 'C']) for (const w of [1440, 390]) for (const p of ['login', 'register']) shots.push([p, w, v, 'light']);
for (const v of ['B', 'C']) shots.push(['login', 390, v, 'dark']);
for (const [p, w, v, theme] of shots) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, colorScheme: theme, locale: 'it-IT', reducedMotion: 'reduce' });
  await ctx.addInitScript((mode) => { localStorage.setItem('themeMode', mode); localStorage.setItem('lx_locale', 'it'); localStorage.setItem('lx_lang_choice', 'it'); localStorage.removeItem('isLoggedIn'); }, theme);
  await ctx.route('**/backend/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));
  const page = await ctx.newPage();
  await page.goto(`${base}/${p}?variant=${v}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}[data-prototype-switcher]{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const name = `web-${p}-${w}-${v}${theme === 'dark' ? '-dark' : ''}.png`;
  await page.screenshot({ path: `${out}/${name}`, fullPage: true });
  console.log(name);
  await ctx.close();
}
await browser.close();
