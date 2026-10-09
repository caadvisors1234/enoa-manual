// 撮る写真の一覧。name が docs/img/ 以下のファイル名になる。
// run() は画面を開いて準備し、{ area, marks, viewport, pad } を返す。
//   area     … 写す範囲（Locator か、その配列）。省略すると画面全体
//   marks    … 枠と番号を付ける場所 [{ target, label }]。target は Locator か、その配列（まとめて 1 つの枠）
//   viewport … 'full' でページ全体が収まる高さにする（既定は 800）
//   width / height … 撮るときの画面の大きさ（既定は 1280×800）
//   loggedOut … ログイン前の画面を撮る
// 店舗ごとの記事の ID は書かない（一覧の先頭を使う）。保存ボタンは押さない。

/** 編集画面は、この幅で撮ると 2 列のまま本文の列が狭くなる */
const EDITOR_WIDTH = 1000;

const newPost = (type) => `wp-admin/post-new.php?post_type=${type}`;
const list = (type) => `wp-admin/edit.php?post_type=${type}`;
const fcPage = (slug) => `wp-admin/admin.php?page=${slug}`;

/** 左のメニューで、親の項目と子の項目に番号を付ける */
function menuShot(name, menuId, childHref, listPath) {
  return {
    name,
    async run(page, h) {
      await h.open(listPath);
      return {
        area: [page.locator('#menu-dashboard'), page.locator(`#${menuId}`)],
        marks: [
          { target: page.locator(`#${menuId} > a`), label: '1' },
          { target: page.locator(`#${menuId} a[href$="${childHref}"]`), label: '2' },
        ],
        pad: 12,
      };
    },
  };
}

/** 新規追加の画面の名前の欄 */
function titleShot(name, type, sample) {
  return {
    name,
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost(type));
      await page.fill('#title', sample);
      await page.locator('#title').blur();
      return {
        viewport: 'full',
        area: [page.locator('.wrap h1').first(), page.locator('#titlewrap')],
        marks: [{ target: page.locator('#title') }],
      };
    },
  };
}

/** 新規追加の画面の右側の枠 1 つ */
function sideBoxShot(name, type, title, mark) {
  return {
    name,
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost(type));
      const box = h.box(title);
      return {
        viewport: 'full',
        area: box,
        marks: mark ? [{ target: mark(box) }] : [],
      };
    },
  };
}

/** 店舗の設定画面のいちばん下の保存ボタン */
function saveShot(name, slug, label) {
  return {
    name,
    async run(page, h) {
      await h.open(fcPage(slug));
      const button = page.locator(`input[type="submit"][value="${label}"], button:has-text("${label}")`).first();
      return {
        viewport: 'full',
        area: button,
        marks: [{ target: button }],
        pad: 16,
      };
    },
  };
}

export const shots = [
  // ---- ログイン・画面の見かた ----
  {
    name: 'login/form',
    loggedOut: true,
    async run(page, h) {
      await h.open('wp-login.php');
      return {
        area: page.locator('#login'),
        marks: [
          { target: page.locator('#user_login'), label: '1' },
          { target: page.locator('#user_pass'), label: '2' },
          { target: page.locator('#wp-submit'), label: '3' },
        ],
      };
    },
  },
  {
    name: 'login/logout',
    async run(page, h) {
      await h.open('wp-admin/index.php');
      await page.hover('#wp-admin-bar-my-account');
      await page.locator('#wp-admin-bar-logout').waitFor();
      return {
        area: [page.locator('#wp-admin-bar-my-account'), page.locator('#wp-admin-bar-logout')],
        marks: [{ target: page.locator('#wp-admin-bar-logout a') }],
        pad: 12,
      };
    },
  },
  {
    name: 'screen/menu',
    async run(page, h) {
      await h.open('wp-admin/index.php');
      return {
        viewport: 'full',
        area: page.locator('#adminmenu'),
        marks: [
          { target: [page.locator('#adminmenu a[href$="page=coverhair-fc-top"]').first(), page.locator('#adminmenu a[href$="page=coverhair-fc-reservation"]').first()] },
        ],
        pad: 8,
      };
    },
  },
  {
    name: 'screen/dashboard',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc'));
      const cards = page.locator('a', { hasText: '入力・確認する' });
      return {
        area: [page.locator('.wrap h1').first(), page.locator('a', { hasText: 'サイトをプレビュー' }).first(), cards.nth(2)],
        marks: [
          { target: cards.first(), label: '1' },
          { target: page.locator('a', { hasText: 'サイトをプレビュー' }).first(), label: '2' },
        ],
      };
    },
  },

  // ---- ヘアスタイル ----
  menuShot('style/menu', 'menu-posts-gallery', 'post-new.php?post_type=gallery', list('gallery')),
  titleShot('style/title', 'gallery', 'ふんわり丸みショートボブ'),
  {
    name: 'style/photo',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost('gallery'));
      const box = h.box('ギャラリースライダーの設定');
      return {
        viewport: 'full',
        area: box,
        marks: [
          { target: box.locator('#show_gallery_slider').locator('xpath=..'), label: '1' },
          { target: box.getByText('画像を選択する', { exact: true }).first(), label: '2' },
          { target: box.getByText('新しいアイテムを追加する', { exact: true }), label: '3' },
        ],
      };
    },
  },
  {
    name: 'style/media',
    width: 900,
    height: 620,
    async run(page, h) {
      await h.open(newPost('gallery'));
      await h.box('ギャラリースライダーの設定').getByText('画像を選択する', { exact: true }).first().click();
      const modal = page.locator('.media-modal:visible').first();
      await modal.waitFor();
      await page.waitForTimeout(1500);
      return {
        area: modal,
        marks: [
          { target: modal.locator('.media-menu-item, .media-router button', { hasText: 'ファイルをアップロード' }).first(), label: '1' },
          { target: modal.locator('.media-button-select, .media-toolbar-primary button').first(), label: '2' },
        ],
        pad: 0,
      };
    },
  },
  sideBoxShot('style/category', 'gallery', 'カテゴリー', (box) => {
    const radios = box.locator('label:has(input[type="radio"])');
    return [radios.first(), radios.last()];
  }),
  sideBoxShot('style/staff', 'gallery', '担当スタッフ', (box) => box.locator('select').first()),
  {
    name: 'style/crop',
    async run(page, h) {
      await h.openFirst(list('gallery'));
      return { viewport: 'full', area: h.box('一覧カード画像'), marks: [] };
    },
  },
  {
    name: 'style/publish',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost('gallery'));
      return { viewport: 'full', area: page.locator('#submitdiv'), marks: [{ target: page.locator('#publish') }] };
    },
  },
  {
    name: 'style/edit',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(list('gallery'));
      return {
        area: [page.locator('.wrap h1').first(), page.locator('#the-list a.row-title').nth(1)],
        marks: [{ target: page.locator('#the-list a.row-title').first() }],
        pad: 12,
      };
    },
  },

  // ---- スタッフ ----
  menuShot('staff/menu', 'menu-posts-coverhair_staff', 'post-new.php?post_type=coverhair_staff', list('coverhair_staff')),
  titleShot('staff/title', 'coverhair_staff', '山田 花子'),
  {
    name: 'staff/basic',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost('coverhair_staff'));
      return { viewport: 'full', area: h.box('スタッフ基本情報'), marks: [] };
    },
  },
  sideBoxShot('staff/category', 'coverhair_staff', 'スタッフ分類', (box) => {
    const labels = box.locator('ul.categorychecklist:visible label');
    return [labels.first(), labels.last()];
  }),
  sideBoxShot('staff/photo', 'coverhair_staff', 'アイキャッチ画像', (box) => box.locator('a').first()),
  {
    name: 'staff/top-photo',
    async run(page, h) {
      await h.openFirst(list('coverhair_staff'));
      return { viewport: 'full', area: h.box('店舗トップ画像'), marks: [] };
    },
  },

  // ---- メニュー ----
  menuShot('menu/menu', 'menu-posts-coverhair_menu', 'post-new.php?post_type=coverhair_menu', list('coverhair_menu')),
  titleShot('menu/title', 'coverhair_menu', 'カット'),
  {
    name: 'menu/price',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost('coverhair_menu'));
      const box = h.box('メニュー情報');
      const inputs = box.locator('input[type="text"]');
      return {
        viewport: 'full',
        area: [box.locator('.postbox-header'), box.getByText('税込価格は自動計算しません').locator('xpath=..')],
        marks: [{ target: [inputs.nth(0).locator('xpath=..'), inputs.nth(1).locator('xpath=..')] }],
      };
    },
  },
  sideBoxShot('menu/category', 'coverhair_menu', 'カテゴリー', (box) => {
    const radios = box.locator('label:has(input[type="radio"])');
    return [radios.first(), radios.last()];
  }),
  sideBoxShot('menu/order', 'coverhair_menu', '投稿の属性', (box) => box.locator('input').first()),
  menuShot('menu/extra-menu', 'menu-posts-coverhair_menu', 'edit.php?post_type=coverhair_menu_extra', list('coverhair_menu')),
  {
    name: 'menu/extra',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost('coverhair_menu_extra'));
      const box = h.box('追加料金・補足の設定');
      return { viewport: 'full', area: [page.locator('#titlewrap'), box], marks: [] };
    },
  },

  // ---- メニューの一括登録 ----
  {
    name: 'bulk/screen',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open('wp-admin/edit.php?post_type=coverhair_menu&page=coverhair-menu-bulk-import');
      const area = page.locator('.wrap textarea').first();
      const button = page.locator('.wrap input[type="submit"], .wrap button[type="submit"]').first();
      return {
        area: [page.locator('.wrap h1').first(), button],
        marks: [
          { target: area, label: '1' },
          { target: button, label: '2' },
        ],
      };
    },
  },

  // ---- クーポン ----
  menuShot('coupon/menu', 'menu-posts-coverhair_coupon', 'post-new.php?post_type=coverhair_coupon', list('coverhair_coupon')),
  titleShot('coupon/title', 'coverhair_coupon', '【初回限定】カット＋カラー'),
  {
    name: 'coupon/content',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost('coverhair_coupon'));
      const box = h.box('クーポン内容');
      return {
        viewport: 'full',
        area: [box.locator('.postbox-header'), box.locator('textarea').first()],
        marks: [],
      };
    },
  },
  sideBoxShot('coupon/target', 'coverhair_coupon', '対象施術', (box) => {
    const labels = box.locator('label');
    return [labels.first(), labels.last()];
  }),
  sideBoxShot('coupon/photo', 'coverhair_coupon', 'アイキャッチ画像', (box) => box.locator('a').first()),

  // ---- お客様の声 ----
  menuShot('review/menu', 'menu-posts-coverhair_review', 'post-new.php?post_type=coverhair_review', list('coverhair_review')),
  {
    name: 'review/text',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost('coverhair_review'));
      await page.fill('#title', 'はるかさん（女性/30代後半）');
      await page.locator('#title').blur();
      return {
        viewport: 'full',
        area: [page.locator('#titlewrap'), page.locator('#postdivrich')],
        marks: [
          { target: page.locator('#title'), label: '1' },
          { target: page.locator('#wp-content-editor-container'), label: '2' },
        ],
      };
    },
  },
  {
    name: 'review/box',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open(newPost('coverhair_review'));
      return { viewport: 'full', area: h.box('お客様の声'), marks: [] };
    },
  },
  sideBoxShot('review/category', 'coverhair_review', '口コミカテゴリー', (box) => {
    const labels = box.locator('ul.categorychecklist:visible label');
    return [labels.first(), labels.last()];
  }),

  // ---- 非公開・削除 ----
  {
    name: 'unpublish/draft',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.openFirst(list('gallery'));
      await page.click('a.edit-post-status');
      await page.locator('#post-status-select .save-post-status').waitFor();
      // 開く動きが終わってから位置を測る
      await page.waitForTimeout(1000);
      return {
        viewport: 'full',
        area: page.locator('#submitdiv'),
        marks: [
          { target: page.locator('#post_status'), label: '1' },
          { target: page.locator('#post-status-select .save-post-status'), label: '2' },
          { target: page.locator('#publish'), label: '3' },
        ],
      };
    },
  },
  {
    name: 'unpublish/trash',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.openFirst(list('gallery'));
      return {
        viewport: 'full',
        area: page.locator('#submitdiv'),
        marks: [{ target: page.locator('#delete-action a') }],
      };
    },
  },
  {
    name: 'unpublish/restore',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.open('wp-admin/edit.php?post_status=trash&post_type=coverhair_menu');
      const row = page.locator('#the-list tr').first();
      await row.hover();
      return {
        area: [page.locator('.wrap h1').first(), row],
        marks: [{ target: row.locator('.row-actions .untrash a') }],
        pad: 12,
      };
    },
  },

  // ---- 店舗トップ ----
  {
    name: 'top/items',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-top'));
      const groups = page.locator('.fc-top-admin__selection-group');
      return {
        viewport: 'full',
        area: groups.nth(0),
        marks: [{ target: groups.nth(0).locator('.fc-top-admin__item-list') }],
      };
    },
  },
  saveShot('top/save', 'coverhair-fc-top', '店舗トップ設定を保存'),
  sideBoxShot('top/placement', 'gallery', '店舗トップ表示', (box) => box.locator('label').first()),
  {
    name: 'top/sections',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-top'));
      return { viewport: 'full', area: h.panel('TOPページに表示するセクション'), marks: [] };
    },
  },
  {
    name: 'top/fv',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-top'));
      const panel = h.panel('ファーストビュー');
      return {
        viewport: 'full',
        area: panel,
        marks: [{ target: panel.getByText('画像を変更', { exact: true }).first() }],
      };
    },
  },

  // ---- 営業時間 ----
  {
    name: 'hours/text',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-store-profile'));
      const hours = page.locator('textarea[name*="[opening_hours]"]');
      const holiday = page.locator('textarea[name*="[closed_days]"]').first();
      return {
        viewport: 'full',
        area: [hours, holiday],
        marks: [
          { target: hours, label: '1' },
          { target: holiday, label: '2' },
        ],
        pad: 40,
      };
    },
  },
  {
    name: 'hours/spec',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-store-profile'));
      const rows = page.locator('input[type="time"]');
      return {
        viewport: 'full',
        area: [page.getByText('営業時間（検索エンジン向け）', { exact: true }).first(), rows.last()],
        marks: [],
        pad: 12,
      };
    },
  },
  saveShot('hours/save', 'coverhair-fc-store-profile', '店舗基本情報を保存'),

  // ---- よくある質問 ----
  {
    name: 'faq/add',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-faq'));
      const panel = h.panel('質問と回答');
      const add = panel.locator('[data-faq-add-item]').first();
      const first = panel.locator('[data-faq-item]').first();
      return {
        viewport: 'full',
        area: [panel.locator('h2').first(), add, first],
        marks: [
          { target: add, label: '1' },
          { target: first.locator('header'), label: '2' },
        ],
      };
    },
  },
  saveShot('faq/save', 'coverhair-fc-faq', 'よくある質問を保存'),

  // ---- 予約 ----
  {
    name: 'reservation/url',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-store-profile'));
      return { viewport: 'full', area: h.panel('予約・地図'), marks: [] };
    },
  },
  {
    name: 'reservation/floating',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-reservation'));
      return { viewport: 'full', area: h.panel('フローティングCTA'), marks: [] };
    },
  },
  {
    name: 'reservation/card',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-reservation'));
      return { viewport: 'full', area: h.panel('ページ下部カードCTA'), marks: [] };
    },
  },
  saveShot('reservation/save', 'coverhair-fc-reservation', '予約・CTA設定を保存'),

  // ---- 選ばれる理由・コンセプト ----
  {
    name: 'reason/detail',
    width: EDITOR_WIDTH,
    async run(page, h) {
      await h.openFirst(list('reason'));
      const box = h.box('詳細ページ');
      const first = box.locator('[data-detail-block]').first();
      return {
        viewport: 'full',
        area: [box.locator('.postbox-header'), first],
        marks: [
          { target: [box.getByRole('button', { name: '＋ 文章・画像' }), box.getByRole('button', { name: '＋ 工程' })], label: '1' },
          { target: first.locator('.coverhair-fc-reason-block__visibility'), label: '2' },
        ],
      };
    },
  },
  {
    name: 'reason/list',
    async run(page, h) {
      await h.openFirst(list('reason'));
      return { viewport: 'full', area: h.box('一覧・TOP表示'), marks: [] };
    },
  },
  {
    name: 'concept/item',
    async run(page, h) {
      await h.open(fcPage('coverhair-fc-store-concept'));
      const item = page.locator('.coverhair-fc-concept-item').first();
      return {
        viewport: 'full',
        area: [h.panel('コンセプト内容').locator('h2').first(), item.locator('.coverhair-fc-concept-content-block').first()],
        marks: [],
      };
    },
  },
  saveShot('concept/save', 'coverhair-fc-store-concept', '店舗コンセプトを保存'),
];
