# 管理画面マニュアル

美容室のホームページ（WordPress）の運用担当者さま向けの、管理画面の操作マニュアルです。
MkDocs Material で作り、GitHub Pages で公開しています。検索エンジンには載せません（全ページ `noindex`）。

## 構成

| 場所 | 中身 |
|---|---|
| `docs/*.md` | 原稿。1 ページに 1 つの作業 |
| `docs/img/` | 画面写真（`tools/capture.mjs` が書き出す）。`sizes.json` は写真の表示サイズ |
| `docs/assets/manual.css` | 見た目 |
| `overrides/main.html` | `noindex` とフォント |
| `hooks/shot_size.py` | 画面写真に実寸の `width`・`height` を付ける |
| `tools/shots.mjs` | 撮る写真の一覧（どの画面の、どこに枠と番号を付けるか） |
| `tools/capture.mjs` | 撮影スクリプト |

## 書き方の決まり

- 題名は「〇〇したい」。ページの頭に 1 行で何ができるかを書き、番号付きの手順を並べる。
- 1 つの手順は 1〜2 行で、写真を 1 枚付ける。ボタンや項目の名前は画面の表記のまま「」で書く。
- 専門用語は使わない。任意の項目は「空欄でかまいません」とまとめる。
- 絵文字・アイコンの飾り・グラデーションは使わない。注意書きは `!!! note "見出し"` の 1 種類だけ。

## 手元で見る

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/mkdocs serve
```

## 画面写真を撮り直す

「店舗運用」の権限のアカウントでログインして撮ります。保存はしません（自動保存の通信も止めます）。

```sh
npm install
npx playwright install chromium
MANUAL_BASE_URL=https://<サイトの URL>/ MANUAL_USER=<ユーザー名> MANUAL_PASS=<パスワード> npm run capture
# 一部だけ撮り直すとき
MANUAL_BASE_URL=... MANUAL_USER=... MANUAL_PASS=... npm run capture -- style/photo style/media
```

ユーザー名とパスワードは、このリポジトリに書かないでください。

- 撮影用のアカウントは表示名を「スタッフ」にして作ります（右上の「こんにちは、〇〇 さん」に写るため）。
- 新規追加の画面を開くと、WordPress が自動下書きを作ります。撮影が終わったら、そのアカウントの自動下書きを消してから、アカウントを削除してください。
- 撮った写真の表示サイズは `docs/img/sizes.json` に記録されます。写真を足したら、このファイルも一緒にコミットします。

## ほかの店舗で使うとき

1. このリポジトリを複製する。
2. `mkdocs.yml` の `site_name`・`site_url`・`copyright` と、`docs/login.md` のログイン URL を書き換える。
3. その店舗のサイトで画面写真を撮り直す。
