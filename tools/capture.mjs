// 管理画面の写真を撮って docs/img/ に WebP で書き出す。
//
// 使い方:
//   MANUAL_BASE_URL=https://example.com/store/ MANUAL_USER=... MANUAL_PASS=... node tools/capture.mjs [写真の名前...]
//
// - アカウントは「店舗運用」の権限で作ったものを使う（担当者さまと同じ画面になる）。
// - 保存はしない。自動保存と編集ロックの通信は遮断する。
// - 押す場所の枠と番号は、撮影するときに画面へ重ねて描く。
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shots } from './shots.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs', 'img');
const { MANUAL_BASE_URL: base, MANUAL_USER: user, MANUAL_PASS: pass } = process.env;

if (!base || !user || !pass) {
  console.error('MANUAL_BASE_URL・MANUAL_USER・MANUAL_PASS を指定してください');
  process.exit(1);
}

const WIDTH = 1280;
const HEIGHT = 800;
const MARK = '#d6402b';

const only = process.argv.slice(2);
const targets = only.length ? shots.filter((s) => only.includes(s.name)) : shots;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
  locale: 'ja-JP',
});

// 自動保存・ハートビート・編集ロックの解除を送らない（DB に書かせない）
await context.route('**/wp-admin/admin-ajax.php', (route) => {
  const body = route.request().postData() || '';
  return /action=(heartbeat|autosave|wp-remove-post-lock)/.test(body) ? route.abort() : route.continue();
});

// ログイン前の画面を撮るための、Cookie を持たないページ
const guestContext = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
  locale: 'ja-JP',
});
const guest = await guestContext.newPage();

const member = await context.newPage();
let page = member;
// サーバーの応答が遅いときがあるので、ログインは 3 回まで試す
for (let attempt = 1; ; attempt++) {
  try {
    await page.goto(new URL('wp-login.php', base).href);
    await page.fill('#user_login', user);
    await page.fill('#user_pass', pass);
    await Promise.all([page.waitForURL(/wp-admin/, { timeout: 60000 }), page.click('#wp-submit')]);
    break;
  } catch (error) {
    if (attempt >= 3) throw error;
    console.error(`ログインをやり直します（${attempt} 回目が失敗）`);
  }
}

const helpers = {
  base,
  /** 見出しの文字でメタボックス（編集画面の枠）を探す */
  box: (title) => page.locator('.postbox').filter({ has: page.locator('.postbox-header h2', { hasText: title }) }).first(),
  /** 見出しの文字で、店舗の設定画面の区画を探す */
  panel: (title) => page.locator('section').filter({ has: page.locator('h2', { hasText: title }) }).first(),
  /** 管理画面の URL を開く */
  open: async (path) => {
    await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
  },
  /** 一覧の先頭の記事の編集画面を開く */
  openFirst: async (listPath) => {
    await helpers.open(listPath);
    const href = await page.locator('#the-list a.row-title').first().getAttribute('href');
    await page.goto(href, { waitUntil: 'networkidle' });
  },
};

/** ページの高さに合わせて、スクロールせずに全体が見える大きさにする */
async function fitViewport(width, height) {
  if (height === 'full') {
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width, height: Math.max(HEIGHT, docHeight) });
  } else {
    await page.setViewportSize({ width, height: height ?? HEIGHT });
  }
}

/** Locator（またはその配列）が占める範囲をまとめた矩形 */
async function unionBox(targets) {
  const boxes = [];
  for (const target of Array.isArray(targets) ? targets : [targets]) {
    const b = await target.boundingBox();
    if (!b) throw new Error(`要素が見つかりません: ${target}`);
    boxes.push(b);
  }
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

/** 枠と番号を重ねる。marks: [{ target: Locator | Locator[], label?: string }] */
async function drawMarks(marks) {
  const rects = [];
  for (const mark of marks) {
    rects.push({ ...(await unionBox(mark.target)), label: mark.label ?? '' });
  }
  await page.evaluate(({ rects, color }) => {
    const maxRight = document.documentElement.clientWidth - 2;
    for (const r of rects) {
      // 画面の端に接する要素（左のメニューなど）でも、枠の四辺が写るように内側へ寄せる
      const left = Math.max(2, r.x - 4);
      const right = Math.min(maxRight, r.x + r.width + 4);
      const frame = document.createElement('div');
      frame.className = 'manual-mark';
      Object.assign(frame.style, {
        position: 'absolute',
        left: `${left + window.scrollX}px`,
        top: `${r.y + window.scrollY - 4}px`,
        width: `${right - left}px`,
        height: `${r.height + 8}px`,
        border: `3px solid ${color}`,
        borderRadius: '4px',
        zIndex: 2147483646,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      });
      document.body.appendChild(frame);
      if (r.label) {
        const badge = document.createElement('div');
        badge.className = 'manual-mark';
        badge.textContent = r.label;
        Object.assign(badge.style, {
          position: 'absolute',
          // 番号は枠の右上に置く（左端の要素でも写る範囲から外れない）
          left: `${r.x + window.scrollX + r.width - 8}px`,
          top: `${r.y + window.scrollY - 15}px`,
          minWidth: '22px',
          height: '22px',
          padding: '0 4px',
          borderRadius: '11px',
          background: color,
          color: '#fff',
          font: '700 13px/22px -apple-system, "Hiragino Sans", sans-serif',
          textAlign: 'center',
          zIndex: 2147483647,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        });
        document.body.appendChild(badge);
      }
    }
  }, { rects, color: MARK });
}

/** 写る範囲：要素の外側に余白を足し、画面の内側に収める */
async function clipOf(area, pad = 16) {
  const vp = page.viewportSize();
  if (!area) return { x: 0, y: 0, width: vp.width, height: vp.height };
  const b = await unionBox(area);
  const x1 = Math.max(0, b.x - pad);
  const y1 = Math.max(0, b.y - pad);
  const x2 = Math.min(vp.width, b.x + b.width + pad);
  const y2 = Math.min(vp.height, b.y + b.height + pad);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

await mkdir(outDir, { recursive: true });

// 写真の CSS 上の大きさ。マニュアルでは実際の画面と同じ大きさで出す（hooks/shot_size.py が読む）
const sizesFile = join(outDir, 'sizes.json');
const sizes = JSON.parse(await readFile(sizesFile, 'utf8').catch(() => '{}'));
const writeSizes = () => {
  const sorted = Object.fromEntries(Object.entries(sizes).sort(([a], [b]) => a.localeCompare(b)));
  return writeFile(sizesFile, `${JSON.stringify(sorted, null, 2)}\n`);
};

for (const shot of targets) {
  page = shot.loggedOut ? guest : member;
  // 幅を狭めて撮ると、マニュアルに載せたときに画面の文字が大きく見える
  const width = shot.width ?? WIDTH;
  await page.setViewportSize({ width, height: shot.height ?? HEIGHT });
  const plan = await shot.run(page, helpers);
  await fitViewport(width, plan.viewport ?? shot.height);
  if (plan.viewport === 'full') await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.querySelectorAll('.manual-mark').forEach((el) => el.remove()));
  // 管理バーのログイン名は写さない（表示名は「スタッフ」で作ったアカウントを使う）
  await page.evaluate(() => {
    document.querySelectorAll('#wp-admin-bar-user-info .username').forEach((el) => {
      el.textContent = '';
    });
  });
  await drawMarks(plan.marks ?? []);
  const clip = await clipOf(plan.area, plan.pad);
  const png = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  const file = join(outDir, `${shot.name}.webp`);
  await mkdir(dirname(file), { recursive: true });
  await sharp(png).webp({ quality: 82 }).toFile(file);
  sizes[`${shot.name}.webp`] = [Math.round(clip.width), Math.round(clip.height)];
  // 途中で止まっても、撮れた写真の大きさは残す
  await writeSizes();
  console.log(`${shot.name}.webp  ${Math.round(clip.width)}×${Math.round(clip.height)}`);
}

await browser.close();
