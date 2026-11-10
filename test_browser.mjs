import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { resolveLiveDb } from './test_db_paths.mjs';

function resolveDevDb() {
  const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'elpis-property-staging-db', '--local',
    '--command', 'CREATE TABLE IF NOT EXISTS _browser_probe (id INTEGER)'], { stdio: 'ignore' });
  for (const name of readdirSync(dir).filter(n => n.endsWith('.sqlite'))) {
    try {
      const candidate = new DatabaseSync(join(dir, name));
      const found = candidate.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_browser_probe'").get();
      candidate.close();
      if (found) return join(dir, name);
    } catch (error) {}
  }
  return resolveLiveDb();
}
const LIVE_DB = resolveDevDb();
const PORT = Number(process.env.BROWSER_TEST_PORT || 8790);
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PASSWORD = randomBytes(18).toString('base64url');
let passed = 0;
let failed = 0;

function hashPw(password) {
  const salt = randomBytes(16);
  const dk = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `pbkdf2$100000$${salt.toString('base64')}$${dk.toString('base64')}`;
}

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  ✅ ${name}`); })
    .catch(error => { failed++; console.error(`  ❌ ${name}\n     ${error.message}`); });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url + '/api/health');
      if (res.ok) return true;
    } catch (error) {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function goto(page, url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      return;
    } catch (error) {
      last = error;
      await page.waitForTimeout(700);
    }
  }
  throw last;
}

async function login(page, email) {
  await goto(page, BASE + '/login');
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.click('#submitBtn');
  // Wait for the authenticated shell, not just a URL change: the clean
  // /login URL can satisfy a naive pathname check before the session cookie
  // is applied.
  await page.waitForSelector('#logoutBtn', { timeout: 25000 });
  await page.evaluate(() => { try { localStorage.setItem('elp-passkey-dismissed', '1'); } catch (_) {} });
}

if (!existsSync(CHROME)) {
  console.log('Chrome not found; skipping browser-level test.');
  process.exit(0);
}

console.log('\n========================================================');
console.log('   Elpis Property — BROWSER DRILL-DOWN / COLOUR / CHAT');
console.log('========================================================\n');

const db = new DatabaseSync(LIVE_DB);
db.exec('PRAGMA foreign_keys = ON;');
const roleId = name => db.prepare('SELECT id FROM roles WHERE name=?').get(name).id;
const branchId = name => db.prepare('SELECT id FROM branches WHERE name=?').get(name).id;
const ikeja = branchId('Branch 1');
const mdRole = roleId('Managing Director');
const marketerRole = roleId('Marketer');

function upsert(email, name, role, branch) {
  db.prepare(`INSERT INTO users (email, password_hash, full_name, role_id, branch_id, is_active, is_test, test_expires_at)
    VALUES (?, ?, ?, ?, ?, 1, 1, datetime('now','+14 days'))
    ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash, full_name=excluded.full_name,
      role_id=excluded.role_id, branch_id=excluded.branch_id, is_active=1, is_test=1,
      test_expires_at=excluded.test_expires_at`)
    .run(email, hashPw(PASSWORD), name, role, branch);
  return db.prepare('SELECT id FROM users WHERE email=?').get(email).id;
}
const mdId = upsert('browser.md@elpisproperty.test', 'Browser MD', mdRole, ikeja);
const marketerId = upsert('browser.marketer@elpisproperty.test', 'Browser Marketer', marketerRole, ikeja);
const financeId = upsert('browser.finance@elpisproperty.test', 'Browser Finance', roleId('Finance Officer'), ikeja);
const adminId = upsert('browser.superadmin@elpisproperty.test', 'Browser Super Admin', roleId('Super Admin'), ikeja);
const clientUserId = upsert('browser.client@elpisproperty.test', 'Browser Client', roleId('Client'), ikeja);
const existingClient = db.prepare("SELECT id FROM clients WHERE client_reference='TEST-BROWSER-CLIENT'").get();
if (existingClient) {
  db.prepare("UPDATE clients SET user_id=?, full_name=?, phone_number=?, email_address=? WHERE id=?")
    .run(clientUserId, 'Browser Client', '08088000999', 'browser.client@elpisproperty.test', existingClient.id);
} else {
  db.prepare(`INSERT INTO clients (client_reference, full_name, phone_number, email_address, status, assigned_branch_id,
    created_by, original_marketer_id, agreed_purchase_price, user_id)
    VALUES ('TEST-BROWSER-CLIENT','Browser Client','08088000999','browser.client@elpisproperty.test','Active Buyer',?,?,?,?,?)`)
    .run(ikeja, mdId, marketerId, 50000000, clientUserId);
}
const teamLeadRole = roleId('Team Lead');
const teamLead = db.prepare("SELECT id FROM users WHERE email='tl.ikeja@elpisproperty.test'").get()
  || { id: upsert('tl.ikeja@elpisproperty.test', 'Branch 1 Team Lead', teamLeadRole, ikeja) };
const existingMarketer = db.prepare("SELECT id FROM users WHERE email='mkt.ikeja@elpisproperty.test'").get();
const testProperty = db.prepare("SELECT id FROM properties WHERE reference='TEST-BROWSER-PROP'").get();
if (!testProperty) {
  db.prepare(`INSERT INTO properties (reference, title, description, property_type, sale_price, state, city,
    branch_id, bedrooms, bathrooms, status, is_published, is_demo, is_archived, created_by)
    VALUES ('TEST-BROWSER-PROP','Browser Test Duplex','Phase 7 search fixture','Duplex',80000000,'FCT','Abuja',?,3,3,'Available',1,0,0,?)`)
    .run(ikeja, mdId);
}
const property = db.prepare('SELECT id FROM properties ORDER BY id LIMIT 1').get();

for (const [ref, temp] of [['TEST-BROWSER-HOT', 'Hot'], ['TEST-BROWSER-WARM', 'Warm'], ['TEST-BROWSER-COLD', 'Cold']]) {
  db.prepare(`INSERT INTO leads (lead_reference, full_name, phone_number, source, status, lead_temperature,
    temperature_updated_at, assigned_marketer_id, team_lead_id, branch_id, created_by, is_demo)
    VALUES (?, ?, ?, 'Browser test', 'Contacted', ?, datetime('now'), ?, ?, ?, ?, 0)
    ON CONFLICT(lead_reference) DO UPDATE SET lead_temperature=excluded.lead_temperature, branch_id=excluded.branch_id`)
    .run(ref, `Browser ${temp} Lead`, '08088' + Math.floor(100000 + Math.random() * 899999), temp,
      marketerId, teamLead ? teamLead.id : null, ikeja, mdId);
}
db.close();

const server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk.toString(); });
server.stderr.on('data', chunk => { serverLog += chunk.toString(); });

let browser;
try {
  if (!(await waitForServer(BASE))) {
    throw new Error('wrangler dev did not start: ' + serverLog.slice(-800));
  }
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await test('security headers, cache headers and quick intro are active', async () => {
    const html = await fetch(BASE + '/login');
    assert(html.status === 200, `login page expected 200, got ${html.status}`);
    assert(html.headers.get('content-security-policy'), 'Content-Security-Policy missing');
    assert(html.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options missing');
    assert(html.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options missing');
    assert((html.headers.get('cache-control') || '').includes('max-age=60'), `HTML cache header missing: ${html.headers.get('cache-control')}`);
    const css = await fetch(BASE + '/assets/css/styles.css');
    assert(css.status === 200, `CSS expected 200, got ${css.status}`);
    assert((css.headers.get('cache-control') || '').includes('max-age=3600'), `asset cache header missing: ${css.headers.get('cache-control')}`);
    const api = await fetch(BASE + '/api/health');
    assert(api.headers.get('server-timing') && api.headers.get('server-timing').includes('app;dur='), 'Server-Timing missing');
    const intro = readFileSync('assets/js/intro-config.js', 'utf8');
    assert(intro.includes('INTRO_MODE: "quick"') && intro.includes('total: 3800'), 'quick intro flag/timing missing');
    assert(intro.includes('total: 15000') && intro.includes('total: 1200'), 'legacy full/short intro timings must remain for rollback');
    assert(/INTRO_INTERNAL:\s*"off"/.test(intro), 'internal-navigation intro skip flag missing');
    const motion = readFileSync('assets/js/motion.js', 'utf8');
    assert(motion.includes('mode === "quick"') && motion.includes('CFG.QUICK'), 'motion.js does not consume the quick mode');
  });

  await test('internal navigation does not replay the intro overlay', async () => {
    await goto(pageA, BASE + '/login');
    await pageA.waitForTimeout(4500);
    await Promise.all([pageA.waitForNavigation({ waitUntil: 'load' }), pageA.click('a[href="signup.html"]')]);
    await pageA.waitForTimeout(400);
    const overlays = await pageA.locator('.elpis-intro').count();
    assert(overlays === 0, `intro overlay replayed on internal navigation (${overlays} present)`);
  });

  await test('drill-down breadcrumbs show National > Branch > Team Lead and can drill back up', async () => {
    await login(pageA, 'browser.md@elpisproperty.test');
    await goto(pageA, `${BASE}/revenue.html?branch_id=${ikeja}&team_lead_id=${teamLead.id}`);
    await pageA.waitForFunction(() => {
      const node = document.getElementById('revBreadcrumbs');
      return node && node.textContent.trim().length > 0;
    }, { timeout: 20000 });
    const crumbs = await pageA.locator('#revBreadcrumbs').innerText();
    assert(/National/i.test(crumbs), `breadcrumb missing National: ${crumbs}`);
    assert(/Branch 1/i.test(crumbs), `breadcrumb missing branch: ${crumbs}`);
    assert(/Branch 1 Team Lead/i.test(crumbs), `breadcrumb missing team lead: ${crumbs}`);
    await pageA.locator('#revBreadcrumbs button').first().click();
    await pageA.waitForFunction(() => {
      const node = document.getElementById('revBreadcrumbs');
      return node && /National/i.test(node.textContent) && !/Branch 1/i.test(node.textContent);
    }, { timeout: 15000 });
    const after = await pageA.locator('#revBreadcrumbs').innerText();
    assert(!/Branch 1/i.test(after), `breadcrumb did not drill back to National: ${after}`);
  });

  await test('hot, warm and cold lead badges use distinct documented colours', async () => {
    await goto(pageA, BASE + '/leads.html');
    await pageA.waitForFunction(() => document.querySelectorAll('#leadBody .badge').length > 0, { timeout: 20000 });
    const colours = await pageA.evaluate(() => {
      const result = {};
      for (const badge of document.querySelectorAll('#leadBody .badge')) {
        const text = badge.textContent.trim();
        if (['Hot', 'Warm', 'Cold'].includes(text) && !result[text]) {
          result[text] = { className: badge.className, colour: getComputedStyle(badge).backgroundColor };
        }
      }
      return result;
    });
    assert(colours.Hot && colours.Warm && colours.Cold, `missing temperature badges: ${JSON.stringify(colours)}`);
    assert(colours.Hot.className.includes('badge-red'), 'hot badge is not red');
    assert(colours.Warm.className.includes('badge-amber'), 'warm badge is not amber');
    assert(colours.Cold.className.includes('badge-gray'), 'cold badge is not grey');
    const set = new Set([colours.Hot.colour, colours.Warm.colour, colours.Cold.colour]);
    assert(set.size === 3, `temperature colours are not distinct: ${JSON.stringify(colours)}`);
  });

  await test('one chat message is delivered over WebSocket between two users', async () => {
    const room = await pageA.evaluate(async ({ targetId }) => {
      const res = await fetch('/api/chat/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: targetId })
      });
      const data = await res.json();
      return { status: res.status, id: data.room_id || data.id || (data.room && data.room.id), error: data.error };
    }, { targetId: marketerId });
    assert(room.status === 200 && room.id, `chat room create failed: ${JSON.stringify(room)}`);
    await login(pageB, 'browser.marketer@elpisproperty.test');
    await goto(pageA, BASE + '/staff-chat.html');
    await goto(pageB, BASE + '/staff-chat.html');
    for (const page of [pageA, pageB]) {
      await page.waitForSelector(`#chatRoomList [data-room="${room.id}"]`, { timeout: 20000 });
      await page.click(`#chatRoomList [data-room="${room.id}"]`);
      await page.waitForFunction(() => {
        const status = document.getElementById('chatStatus');
        return status && /connected/i.test(status.textContent);
      }, { timeout: 20000 });
    }
    const message = 'Browser WebSocket audit message ' + Date.now();
    await pageA.fill('#chatInput', message);
    await pageA.click('#chatSendBtn');
    await pageB.waitForFunction(expected => {
      return Array.from(document.querySelectorAll('#chatMessages .chat-message-bubble')).some(node => node.textContent === expected);
    }, message, { timeout: 15000 });
  });

  await test('assistant loader is present on every page except offline', async () => {
    const pages = readdirSync('.').filter(f => f.endsWith('.html'));
    for (const page of pages) {
      const html = readFileSync(page, 'utf8');
      if (page === 'offline.html') {
        assert(!html.includes('digital-human/index.js'), 'offline page must not mount the assistant');
      } else {
        assert(html.includes('assets/js/digital-human/index.js'), `${page} is missing the assistant loader`);
      }
    }
  });

  await test('assistant mounts, answers a typed question and closes with Escape', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await goto(page, BASE + '/');
    await page.waitForSelector('#elp-dh-root .elp-dh-launcher', { timeout: 20000 });
    assert(await page.locator('.elp-dh-launcher').isVisible(), 'launcher is not visible');
    await page.click('.elp-dh-launcher');
    await page.waitForSelector('.elp-dh-panel:not([hidden])', { timeout: 10000 });
    const title = await page.locator('.elp-dh-title').innerText();
    assert(title === 'Adaora', `expected Adaora, got ${title}`);
    const portrait = await page.locator('.elp-dh-header__avatar img').getAttribute('src');
    assert(/assistants\/adaora\.jpg$/.test(portrait || ''), `Adaora portrait missing: ${portrait}`);
    const department = await page.locator('.elp-dh-department').innerText();
    assert(/Concierge/i.test(department), `department label missing: ${department}`);
    await page.fill('#elp-dh-input', 'I want to find a property');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.elp-dh-bubble'));
      return nodes.some(n => /(found|catalogue|available propert)/i.test(n.textContent));
    }, { timeout: 10000 });
    const actions = await page.locator('.elp-dh-action').count();
    assert(actions > 0, 'assistant reply has no actions');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.elp-dh-panel')?.hidden === true, { timeout: 5000 });
    const focused = await page.evaluate(() => document.activeElement?.classList.contains('elp-dh-launcher'));
    assert(focused, 'focus did not return to the launcher after Escape');
    assert(pageErrors.length === 0, `assistant raised page errors: ${pageErrors.join('; ')}`);
    await context.close();
  });

  await test('assistant panel fits a mobile viewport without overflow', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await goto(page, BASE + '/login');
    await page.waitForSelector('#elp-dh-root .elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.waitForSelector('.elp-dh-panel:not([hidden])', { timeout: 10000 });
    const box = await page.locator('.elp-dh-panel').boundingBox();
    assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845,
      `panel outside mobile viewport: ${JSON.stringify(box)}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!overflow, 'assistant introduced horizontal overflow on mobile');
    const composer = await page.locator('#elp-dh-input').isVisible();
    assert(composer, 'composer is not visible on mobile');
    await context.close();
  });

  await test('assistant introduces itself on entry', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await goto(page, BASE + '/');
    await page.waitForSelector('.elp-dh-intro', { timeout: 20000 });
    const text = await page.locator('.elp-dh-intro__text').innerText();
    assert(/Adaora/.test(text) && /Elpis Property/.test(text), `unexpected intro: ${text}`);
    await page.click('.elp-dh-intro__open');
    await page.waitForSelector('.elp-dh-panel:not([hidden])', { timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.elp-dh-intro', { timeout: 20000 });
    assert(await page.locator('.elp-dh-intro').isVisible(), 'introduction missing after a new page entry');
    await context.close();
  });

  await test('dashboard entry greets the signed-in role', async () => {
    await pageA.evaluate(() => { try { localStorage.removeItem('elp-dh-intro-home-at'); localStorage.removeItem('elp-dh-intro-dashboard-at'); } catch (_) {} });
    await goto(pageA, BASE + '/dashboard.html');
    await pageA.waitForSelector('.elp-dh-intro', { timeout: 20000 });
    const text = await pageA.locator('.elp-dh-intro__text').innerText();
    assert(/Welcome back/i.test(text) && /dashboard/i.test(text), `dashboard intro missing role context: ${text}`);
    await pageA.locator('.elp-dh-intro__close').click();
  });

  await test('specialist handover switches persona and preserves the conversation', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await goto(page, BASE + '/');
    await page.waitForSelector('.elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.waitForSelector('.elp-dh-panel:not([hidden])', { timeout: 10000 });
    await page.fill('#elp-dh-input', 'I need a property');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => document.querySelector('.elp-dh-title')?.textContent === 'Solomon', null, { timeout: 12000 });
    const solomonPortrait = await page.locator('.elp-dh-header__avatar img').getAttribute('src');
    assert(/assistants\/solomon\.jpg$/.test(solomonPortrait || ''), `Solomon portrait missing: ${solomonPortrait}`);
    assert((await page.locator('.elp-dh-bubble').allInnerTexts()).some(t => t.includes('I need a property')), 'conversation context was lost on handover');
    await page.fill('#elp-dh-input', 'I want to rent');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => document.querySelector('.elp-dh-title')?.textContent === 'Emeka', null, { timeout: 12000 });
    await page.fill('#elp-dh-input', 'bring Adaora back');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => document.querySelector('.elp-dh-title')?.textContent === 'Adaora', null, { timeout: 12000 });
    assert(pageErrors.length === 0, `persona flow raised page errors: ${pageErrors.join('; ')}`);
    await context.close();
  });

  await test('dashboard greetings and summaries are role-aware', async () => {
    const cases = [
      { email: 'browser.marketer@elpisproperty.test', path: '/dashboard.html', greeting: /marketer dashboard/i, answer: /open leads/i },
      { email: 'browser.finance@elpisproperty.test', path: '/finance-dashboard.html', greeting: /account dashboard/i, answer: /Today:/i },
      { email: 'browser.superadmin@elpisproperty.test', path: '/dashboard.html', greeting: /administration dashboard/i, answer: /active staff/i }
    ];
    for (const item of cases) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, item.email);
      await page.evaluate(() => {
        try {
          localStorage.removeItem('elp-dh-intro-home-at');
          localStorage.removeItem('elp-dh-intro-dashboard-at');
        } catch (_) {}
      });
      await goto(page, BASE + item.path);
      await page.waitForSelector('.elp-dh-intro', { timeout: 30000 });
      const greeting = await page.locator('.elp-dh-intro__text').innerText();
      assert(item.greeting.test(greeting), `${item.email} greeting: ${greeting}`);
      await page.click('.elp-dh-intro__open');
      await page.waitForSelector('.elp-dh-panel:not([hidden])', { timeout: 15000 });
      await page.fill('#elp-dh-input', 'summary');
      await page.press('#elp-dh-input', 'Enter');
      await page.waitForFunction(source => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => new RegExp(source, 'i').test(n.textContent)), item.answer.source, { timeout: 25000 });
      const bubbles = await page.locator('.elp-dh-bubble').allInnerTexts();
      assert(bubbles.some(text => item.answer.test(text)), `${item.email} summary missing: ${bubbles.slice(-3).join(' | ')}`);
      await context.close();
    }
  });

  await test('client dashboard gets an account greeting and a real balance summary', async () => {
    const context = await browser.newContext();
    const loginRes = await context.request.post(BASE + '/api/login', {
      data: { email: 'browser.client@elpisproperty.test', password: PASSWORD }
    });
    assert(loginRes.ok(), `client login failed: ${loginRes.status()}`);
    const page = await context.newPage();
    await goto(page, BASE + '/client-dashboard.html');
    await page.waitForSelector('.elp-dh-intro', { timeout: 20000 });
    const greeting = await page.locator('.elp-dh-intro__text').innerText();
    assert(/dashboard is ready/i.test(greeting) && /explore properties/i.test(greeting), `client greeting: ${greeting}`);
    await page.click('.elp-dh-intro__open');
    await page.fill('#elp-dh-input', 'summary');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForTimeout(1800);
    const bubbles = await page.locator('.elp-dh-bubble').allInnerTexts();
    assert(bubbles.some(text => /Outstanding balance/i.test(text) && /₦/.test(text)), `client summary missing: ${bubbles.slice(-3).join(' | ')}`);
    await context.close();
  });

  await test('every persona has a self-hosted portrait', async () => {
    const { PERSONAS } = await import('./assets/js/digital-human/config.js');
    for (const persona of PERSONAS) {
      assert(existsSync(persona.avatar), `${persona.key} portrait missing: ${persona.avatar}`);
    }
  });

  await test('form guidance reads real validity and never exposes passwords', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await goto(page, BASE + '/signup.html');
    await page.waitForSelector('.elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.waitForSelector('.elp-dh-panel:not([hidden])', { timeout: 10000 });
    await page.fill('#password', 'SuperSecret123!');
    await page.fill('#confirmPassword', 'SuperSecret123!');
    await page.click('.elp-dh-formcheck');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /missing/i.test(n.textContent)), { timeout: 10000 });
    let bubbles = await page.locator('.elp-dh-bubble').allInnerTexts();
    assert(bubbles.some(text => /full name is missing/i.test(text)), `expected missing full name: ${bubbles.slice(-2).join(' | ')}`);
    assert(!bubbles.some(text => text.includes('SuperSecret123')), 'password value leaked into the transcript');

    await page.fill('#email', 'not-an-email');
    await page.click('.elp-dh-formcheck');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /valid email address/i.test(n.textContent)), { timeout: 10000 });
    bubbles = await page.locator('.elp-dh-bubble').allInnerTexts();
    assert(!bubbles.some(text => text.includes('not-an-email')), 'email value leaked into the transcript');

    await page.evaluate(() => document.getElementById('signupForm').requestSubmit());
    await page.waitForTimeout(400);
    const firstCount = (await page.locator('.elp-dh-bubble').allInnerTexts()).filter(text => /missing/i.test(text)).length;
    await page.evaluate(() => document.getElementById('signupForm').requestSubmit());
    await page.waitForTimeout(400);
    const secondCount = (await page.locator('.elp-dh-bubble').allInnerTexts()).filter(text => /missing/i.test(text)).length;
    assert(secondCount === firstCount, `form guidance repeated on a second invalid submit (${firstCount} → ${secondCount})`);
    await context.close();
  });

  await test('property search reads the live catalogue and compare keeps context', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await goto(page, BASE + '/');
    await page.waitForSelector('.elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.waitForSelector('.elp-dh-panel:not([hidden])', { timeout: 10000 });
    await page.fill('#elp-dh-input', 'find a 3 bedroom duplex in Abuja under 90 million');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /Browser Test Duplex/.test(n.textContent)), { timeout: 15000 });
    const reply = (await page.locator('.elp-dh-bubble').allInnerTexts()).find(text => /Browser Test Duplex/.test(text));
    assert(/₦80,000,000/.test(reply), `search price missing: ${reply}`);
    await page.fill('#elp-dh-input', 'compare these');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /comparison from the live catalogue/i.test(n.textContent)), { timeout: 12000 });
    await context.close();
  });

  await test('verified payments are announced once and pending payments stay silent', async () => {
    const context = await browser.newContext();
    let payload = { notifications: [], unread_count: 0 };
    await context.route('**/api/staff/notifications*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(payload)
    }));
    const page = await context.newPage();
    await login(page, 'browser.marketer@elpisproperty.test');
    await page.evaluate(() => { try { sessionStorage.removeItem('elp-dh-payments-v1'); } catch (_) {} });
    await goto(page, BASE + '/dashboard.html');
    await page.waitForSelector('.elp-dh-launcher', { timeout: 20000 });
    await page.waitForTimeout(600);

    payload = {
      notifications: [
        { id: 9001, type: 'payment.verified', title: 'Payment Verified', message: '₦150,000 was verified for Browser Client (TEST-BROWSER-CLIENT).', is_read: 0, created_at: '2026-11-10 10:00:00' }
      ],
      unread_count: 1
    };
    const first = await page.evaluate(() => window.ElpAssistant.payments.checkNow());
    assert(first.length === 1, `expected one payment event, got ${first.length}`);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble, .elp-dh-intro__text')).some(n => /Customer payment successful/.test(n.textContent)), { timeout: 10000 });
    const second = await page.evaluate(() => window.ElpAssistant.payments.checkNow());
    assert(second.length === 0, 'duplicate payment event was announced again');

    payload = {
      notifications: [
        { id: 9002, type: 'payment.pending', title: 'Payment Pending', message: 'Pending payment', is_read: 0, created_at: '2026-11-10 10:01:00' },
        { id: 9003, type: 'payment.failed', title: 'Payment Failed', message: 'Failed payment', is_read: 0, created_at: '2026-11-10 10:02:00' }
      ],
      unread_count: 2
    };
    const pending = await page.evaluate(() => window.ElpAssistant.payments.checkNow());
    assert(pending.length === 0, 'pending/failed payments must never be announced');
    await context.close();
  });

  await test('client virtual account payment uses the ELPIS ACCESS announcement', async () => {
    const context = await browser.newContext();
    let payload = { notifications: [], unread_count: 0 };
    await context.route('**/api/client/notifications*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(payload)
    }));
    const loginRes = await context.request.post(BASE + '/api/login', {
      data: { email: 'browser.client@elpisproperty.test', password: PASSWORD }
    });
    assert(loginRes.ok(), `client login failed: ${loginRes.status()}`);
    const page = await context.newPage();
    await goto(page, BASE + '/client-dashboard.html');
    await page.waitForSelector('.elp-dh-launcher', { timeout: 20000 });
    await page.waitForTimeout(600);
    payload = {
      notifications: [
        { id: 9101, type: 'payment.verified', title: 'Payment Successfully Verified', message: 'Your payment of ₦200,000 has been verified. Official Receipt #RCP-TEST is available.', is_read: 0, created_at: '2026-11-10 10:05:00' }
      ],
      unread_count: 1
    };
    const events = await page.evaluate(() => window.ElpAssistant.payments.checkNow());
    assert(events.length === 1, `expected one client payment event, got ${events.length}`);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble, .elp-dh-intro__text')).some(n => /Payment to ELPIS ACCESS successful/.test(n.textContent)), { timeout: 10000 });
    await context.close();
  });

  await test('handover requests stay pending until a staff member accepts', async () => {
    const context = await browser.newContext();
    let handoverStatus = 'requested';
    await context.route('**/api/assistant/staff*', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ staff: [{ id: 999, full_name: 'Browser Manager', role: 'Branch Manager', branch_name: 'Branch 1', available: true }] })
    }));
    await context.route('**/api/assistant/handovers**', route => {
      const request = route.request();
      const url = request.url();
      if (request.method() === 'POST' && /\/handovers$/.test(url)) {
        return route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({ handover: { id: 555, status: 'requested', staff_name: 'Browser Manager' } })
        });
      }
      if (request.method() === 'GET' && /\/handovers\/555$/.test(url)) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ handover: { id: 555, status: handoverStatus, staff_name: 'Browser Manager' } })
        });
      }
      return route.continue();
    });
    const loginRes = await context.request.post(BASE + '/api/login', {
      data: { email: 'browser.client@elpisproperty.test', password: PASSWORD }
    });
    assert(loginRes.ok(), `client login failed: ${loginRes.status()}`);
    const page = await context.newPage();
    await goto(page, BASE + '/client-dashboard.html');
    await page.waitForSelector('.elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.fill('#elp-dh-input', 'I want to speak to a human');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /Available now/.test(n.textContent)), { timeout: 12000 });
    await page.getByRole('button', { name: /Connect me to Browser Manager/ }).click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /not.*active until they accept/i.test(n.textContent)), { timeout: 12000 });
    const pendingBubbles = await page.locator('.elp-dh-bubble').allInnerTexts();
    assert(!pendingBubbles.some(text => /accepted your handover request/i.test(text)), 'handover must not be reported as accepted before staff respond');
    handoverStatus = 'accepted';
    await page.waitForTimeout(9000);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /accepted your handover request/i.test(n.textContent)), { timeout: 12000 });
    await context.close();
  });

  await test('microphone recording transcribes audio and sends it as a message', async () => {
    const context = await browser.newContext();
    await context.route('**/api/assistant/transcribe', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'hello from my microphone' })
    }));
    await context.addInitScript(() => {
      try { localStorage.setItem('elp-dh-engine-v4','1'); localStorage.setItem('elp-dh-voice-engine', 'device'); } catch (_) {}
      navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
      class FakeMediaRecorder {
        static isTypeSupported() { return true; }
        constructor(stream, options = {}) {
          this.state = 'inactive';
          this.mimeType = options.mimeType || 'audio/webm';
        }
        start() { this.state = 'recording'; }
        stop() {
          this.state = 'inactive';
          if (this.ondataavailable) this.ondataavailable({ data: new Blob(['fake-audio'], { type: this.mimeType }) });
          if (this.onstop) this.onstop();
        }
      }
      Object.defineProperty(window, 'MediaRecorder', { value: FakeMediaRecorder, configurable: true });
    });
    const page = await context.newPage();
    await goto(page, BASE + '/login');
    await page.waitForSelector('.elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.click('.elp-dh-mic');
    await page.waitForFunction(() => /Listening/.test(document.getElementById('elp-dh-voice-status')?.textContent || ''), { timeout: 8000 });
    await page.click('.elp-dh-mic');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => n.textContent === 'hello from my microphone'), { timeout: 12000 });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /Adaora/.test(n.textContent)), { timeout: 8000 });
    await context.close();
  });

  await test('Nigerian Pidgin is understood and answered without losing context', async () => {
    const context = await browser.newContext();
    await context.addInitScript(() => { try { localStorage.setItem('elp-dh-engine-v4','1'); localStorage.setItem('elp-dh-voice-engine', 'device'); } catch (_) {} });
    const page = await context.newPage();
    await goto(page, BASE + '/');
    await page.waitForSelector('.elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.selectOption('.elp-dh-language-select', 'pidgin');
    await page.fill('#elp-dh-input', 'Abeg I need house for Abuja under 90 million');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /No wahala/i.test(n.textContent) && /Browser Test Duplex/.test(n.textContent)), { timeout: 15000 });
    await page.selectOption('.elp-dh-language-select', 'english');
    await page.fill('#elp-dh-input', 'compare these');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /comparison from the live catalogue/i.test(n.textContent)), { timeout: 12000 });
    const bubbles = await page.locator('.elp-dh-bubble').allInnerTexts();
    assert(bubbles.some(text => text.includes('Abeg I need house for Abuja')), 'Pidgin context was lost after switching language');
    await context.close();
  });

  await test('neural voice failure falls back to the device voice', async () => {
    const context = await browser.newContext();
    await context.route('**/assets/headtts/modules/headtts.mjs', route => route.abort());
    await context.addInitScript(() => {
      try { localStorage.setItem('elp-dh-engine-v4','1'); localStorage.setItem('elp-dh-engine-v3','1'); localStorage.setItem('elp-dh-voice-engine','neural'); } catch (_) {}
      window.__voiceSpoken = [];
      class FakeUtterance { constructor(text) { this.text = text; } }
      const synth = {
        speaking: false,
        getVoices: () => [{ name: 'Samantha', lang: 'en-NG', localService: true }],
        addEventListener() {}, removeEventListener() {},
        speak(u) { window.__voiceSpoken.push(u.text); this.speaking = true; setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, 10); }, 5); },
        cancel() { this.speaking = false; }, resume() {}, pause() {}
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
    });
    const page = await context.newPage();
    await goto(page, BASE + '/login');
    await page.waitForSelector('.elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.click('.elp-dh-voice-btn');
    await page.waitForFunction(() => window.__voiceSpoken.length >= 1, { timeout: 15000 });
    await page.fill('#elp-dh-input', 'Hello Adaora');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => window.__voiceSpoken.length >= 2, { timeout: 15000 });
    const status = await page.locator('#elp-dh-voice-status').innerText();
    assert(/device|Voice ready|unavailable|Speaking/i.test(status), `fallback status missing: ${status}`);
    await context.close();
  });

  await test('a passkey can be registered, used to sign in and removed', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, 'browser.md@elpisproperty.test');
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const authenticator = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true
      }
    });
    await goto(page, BASE + '/passkeys.html');
    await page.waitForSelector('#addPasskeyBtn', { timeout: 20000 });
    await page.click('#addPasskeyBtn');
    await page.waitForFunction(() => document.querySelectorAll('.passkey-device').length >= 1, { timeout: 20000 });
    const count = await page.locator('.passkey-device').count();
    assert(count >= 1, 'passkey was not listed after registration');
    await page.evaluate(async () => { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); });
    await goto(page, BASE + '/login.html');
    await page.click('#passkeyLoginBtn');
    await page.waitForURL(/dashboard|client-dashboard/, { timeout: 25000 });
    assert(await page.locator('#logoutBtn').count() > 0, 'passkey login did not create an authenticated session');
    await goto(page, BASE + '/passkeys.html');
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') await dialog.accept(PASSWORD);
      else await dialog.accept();
    });
    await page.click('.passkey-device .passkey-danger');
    await page.waitForFunction(() => (document.querySelector('#passkeyList')?.textContent || '').includes('No passkeys yet'), { timeout: 15000 });
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: authenticator.authenticatorId });
    await context.close();
  });

  await test('voice controls stay hidden and typing still works when speech APIs are missing', async () => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      try {
        Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true });
        Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
        Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
        Object.defineProperty(window, 'MediaRecorder', { value: undefined, configurable: true });
        Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
      } catch (error) { /* ignore */ }
    });
    const page = await context.newPage();
    await goto(page, BASE + '/login');
    await page.waitForSelector('#elp-dh-root .elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.waitForSelector('.elp-dh-panel:not([hidden])', { timeout: 10000 });
    assert(await page.locator('.elp-dh-mic').isHidden(), 'microphone button must be hidden without recognition');
    assert(await page.locator('.elp-dh-voice-btn').first().isHidden(), 'voice toggle must be hidden without synthesis');
    const status = await page.locator('#elp-dh-voice-status').innerText();
    assert(/not supported/i.test(status), `unsupported status missing: ${status}`);
    await page.fill('#elp-dh-input', 'hello');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /Hello/.test(n.textContent));
    }, { timeout: 10000 });
    await context.close();
  });

  await test('voice engine speaks, replays, stops and accepts a spoken transcript', async () => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      try { localStorage.setItem('elp-dh-engine-v4','1'); localStorage.setItem('elp-dh-voice-engine', 'device'); } catch (_) {}
      Object.defineProperty(window, 'MediaRecorder', { value: undefined, configurable: true });
      window.__voiceSpoken = [];
      window.__voiceCancelled = 0;
      class FakeUtterance {
        constructor(text) { this.text = text; this.onstart = null; this.onend = null; this.onerror = null; }
      }
      const voices = [
        { name: 'Samantha', lang: 'en-NG', localService: true, default: false },
        { name: 'Daniel', lang: 'en-NG', localService: true, default: true }
      ];
      const synth = {
        speaking: false,
        getVoices: () => voices,
        addEventListener() {}, removeEventListener() {},
        speak(utterance) {
          window.__voiceSpoken.push(utterance.text);
          synth.speaking = true;
          setTimeout(() => {
            utterance.onstart && utterance.onstart();
            setTimeout(() => { synth.speaking = false; utterance.onend && utterance.onend(); }, 800);
          }, 5);
        },
        cancel() { synth.speaking = false; window.__voiceCancelled += 1; },
        resume() {}, pause() {}
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
      class FakeRecognition {
        start() {
          setTimeout(() => {
            this.onstart && this.onstart();
            const result = [{ transcript: 'I want a house' }];
            result.isFinal = true;
            this.onresult && this.onresult({ resultIndex: 0, results: [result] });
            this.onend && this.onend();
          }, 30);
        }
        stop() { this.onend && this.onend(); }
        abort() {}
      }
      Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true });
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: FakeRecognition, configurable: true });
    });
    const page = await context.newPage();
    await goto(page, BASE + '/');
    await page.waitForSelector('#elp-dh-root .elp-dh-launcher', { timeout: 20000 });
    await page.click('.elp-dh-launcher');
    await page.waitForSelector('.elp-dh-panel:not([hidden])', { timeout: 10000 });

    await page.click('.elp-dh-voice-btn');
    await page.waitForFunction(() => window.__voiceSpoken.length >= 1, { timeout: 10000 });
    assert((await page.locator('.elp-dh-voice-btn').first().getAttribute('aria-pressed')) === 'true', 'voice toggle did not turn on');

    await page.fill('#elp-dh-input', 'I want a house');
    await page.press('#elp-dh-input', 'Enter');
    await page.waitForFunction(() => window.__voiceSpoken.length >= 2, { timeout: 10000 });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => /(found|catalogue|available propert)/i.test(n.textContent)), { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('.elp-dh-title')?.textContent === 'Solomon', null, { timeout: 12000 });
    const voiceName = await page.evaluate(() => window.ElpAssistant.voiceSnapshot().voiceName);
    assert(/Daniel/i.test(voiceName), `male voice not selected after handover: ${voiceName}`);

    await page.getByRole('button', { name: /Replay/ }).click();
    await page.waitForFunction(() => window.__voiceSpoken.length >= 3, { timeout: 10000 });
    await page.getByRole('button', { name: /Stop/ }).waitFor({ state: 'visible', timeout: 5000 });

    const beforeStop = await page.evaluate(() => window.__voiceCancelled);
    await page.getByRole('button', { name: /Stop/ }).click();
    await page.waitForFunction(previous => window.__voiceCancelled > previous, beforeStop, { timeout: 10000 });

    await page.click('.elp-dh-mic');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.elp-dh-bubble')).some(n => n.textContent === 'I want a house'), { timeout: 10000 });

    await page.click('.elp-dh-voice-btn');
    await page.waitForTimeout(300);
    const muted = await page.locator('.elp-dh-voice-btn').first().getAttribute('aria-pressed');
    assert(muted === 'false', 'voice toggle did not mute');
    await context.close();
  });
} catch (error) {
  failed++;
  console.error('  ❌ browser harness\n     ' + error.message);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 800));
  try {
    const cleanup = new DatabaseSync(LIVE_DB);
    cleanup.exec('PRAGMA foreign_keys = ON;');
    const ids = cleanup.prepare("SELECT id FROM users WHERE email LIKE 'browser.%@elpisproperty.test'").all().map(row => row.id);
    if (ids.length) {
      const marks = ids.map(() => '?').join(',');
      cleanup.prepare(`DELETE FROM chat_messages WHERE sender_id IN (${marks})`).run(...ids);
      cleanup.prepare(`DELETE FROM chat_room_members WHERE user_id IN (${marks})`).run(...ids);
      cleanup.prepare(`DELETE FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE created_by IN (${marks}))`).run(...ids);
      cleanup.prepare(`DELETE FROM chat_rooms WHERE created_by IN (${marks})`).run(...ids);
      cleanup.prepare(`DELETE FROM lead_follow_ups WHERE staff_id IN (${marks}) OR lead_id IN (SELECT id FROM leads WHERE lead_reference LIKE 'TEST-BROWSER-%')`).run(...ids);
      cleanup.prepare(`DELETE FROM lead_temperature_history WHERE changed_by IN (${marks}) OR lead_id IN (SELECT id FROM leads WHERE lead_reference LIKE 'TEST-BROWSER-%')`).run(...ids);
      cleanup.prepare(`DELETE FROM leads WHERE lead_reference LIKE 'TEST-BROWSER-%'`).run();
      cleanup.prepare(`DELETE FROM clients WHERE client_reference='TEST-BROWSER-CLIENT'`).run();
      cleanup.prepare(`DELETE FROM properties WHERE reference='TEST-BROWSER-PROP'`).run();
      cleanup.prepare(`DELETE FROM sessions WHERE user_id IN (${marks})`).run(...ids);
      cleanup.prepare(`DELETE FROM staff_profiles WHERE user_id IN (${marks})`).run(...ids);
      cleanup.prepare(`DELETE FROM team_members WHERE user_id IN (${marks})`).run(...ids);
      cleanup.prepare(`DELETE FROM notifications WHERE user_id IN (${marks})`).run(...ids);
      cleanup.prepare(`DELETE FROM password_reset_tokens WHERE user_id IN (${marks})`).run(...ids);
      cleanup.prepare(`UPDATE audit_logs SET actor_user_id=NULL WHERE actor_user_id IN (${marks})`).run(...ids);
      cleanup.prepare(`UPDATE users SET manager_id=NULL, reactivated_by=NULL WHERE manager_id IN (${marks}) OR reactivated_by IN (${marks})`).run(...ids, ...ids);
      cleanup.prepare(`DELETE FROM users WHERE id IN (${marks})`).run(...ids);
    }
    cleanup.exec('DROP TABLE IF EXISTS _browser_probe;');
    cleanup.close();
  } catch (error) { console.error('  ⚠ browser cleanup:', error.message); }
}

console.log(`\n   RESULT: ${passed} PASSED | ${failed} FAILED\n`);
process.exit(failed === 0 ? 0 : 1);
