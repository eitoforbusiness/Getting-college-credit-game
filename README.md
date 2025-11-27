# Getting-college-credit-game

Next.js 16（App Router）と TypeScript、Tailwind CSS v4 を使ったフロントエンドプロジェクトです。`create-next-app` のテンプレートをベースにしているため、即座に開発を始められます。

## 必要環境
- Node.js 18.18 以上（Next.js の推奨環境は 20+）
- npm 10 以上

## 参加手順
1. リポジトリをクローン  
   ```bash
   git clone https://github.com/USER/Getting-college-credit-game.git
   cd Getting-college-credit-game
   ```
2. Node.js のバージョンをそろえる（任意だが推奨）  
   ```bash
   nvm install 20
   nvm use 20
   ```
3. 依存関係をインストール  
   ```bash
   npm install
   ```
4. 開発サーバーを起動し、`http://localhost:3000` を確認  
   ```bash
   npm run dev
   ```


## セットアップ
```bash
npm install
```

## コマンド
- `npm run dev` : 開発サーバーを `http://localhost:3000` で起動
- `npm run lint` : ESLint（Flat Config）で静的解析
- `npm run build` : 本番ビルドを生成
- `npm run start` : `npm run build` 後の成果物を起動

## ディレクトリ構成（主要部）
- `src/app` : App Router（Server Components）のページ/レイアウト
- `public` : 静的アセット
- `next.config.ts` : Next.js の設定
- `tsconfig.json` : TypeScript 設定（`@/*` エイリアスを利用可能）
- `postcss.config.mjs` : Tailwind CSS v4 用の PostCSS 設定

## 開発フローの目安
- 作業前に `main` を最新にしてからトピックブランチ（例: `feature/awesome-ui`）を切る
- 実装後は `npm run lint` を通してから PR を作成
- PR には「目的」「変更点」「確認手順」を簡潔に記載
- UI 変更がある場合はスクリーンショットや動画を添付

## トラブルシューティング
- 依存関係の解決で詰まったら `rm -rf node_modules package-lock.json && npm install`
- Node のバージョン差でエラーが出る場合は `nvm use 20` など推奨バージョンに切り替える
- Lint に関する質問や新しいルール追加の提案は Issue/PR で相談

## 今後の進め方
1. `src/app/page.tsx` を編集して UI を実装
2. 必要に応じて `src/app` 以下にルートや API Route（App Router）を追加
3. Tailwind CSS のユーティリティを使ってスタイリング

Next.js の詳細は [公式ドキュメント](https://nextjs.org/docs) を参照してください。Vercel へのデプロイもシームレスに行えます。
