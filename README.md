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

## M5StickCplus2 セットアップ

### 必要なもの
- M5StickCplus2
- USBケーブル（Type-C）
- Arduino IDE

### Arduino側のセットアップ

1. **Arduino IDEのセットアップ**
   - Arduino IDEをインストール
   - ファイル → 環境設定 → 追加のボードマネージャーのURLに以下を追加:
     ```
     https://m5stack.oss-cn-shenzhen.aliyun.com/package_m5stack_index.json
     ```
   - ツール → ボード → ボードマネージャーで「M5Stack」を検索してインストール

2. **ライブラリのインストール**
   - スケッチ → ライブラリをインクルード → ライブラリの管理
   - 「M5StickCPlus2」を検索してインストール
   - 「ArduinoBLE」を検索してインストール

3. **スケッチのアップロード**
   - `m5stickcplus2_arduino.ino` をArduino IDEで開く
   - ツール → ボード → M5StickC → M5StickCPlus2 を選択
   - ツール → シリアルポートで適切なポートを選択
   - スケッチ → マイコンボードに書き込む

4. **動作確認**
   - アップロード後、M5StickCplus2の画面に「BLE Ready」と表示されれば成功
   - 「Waiting...」と表示されている間は接続待ち状態です

### Web側の接続手順

1. **開発サーバーの起動**
   ```bash
   npm run dev
   ```

2. **ブラウザで接続**
   - Chrome、Edge、またはOperaブラウザで `http://localhost:3000` を開く
   - ⚠️ Web Bluetooth APIはHTTPS環境またはlocalhostでのみ動作します

3. **M5StickCplus2との接続**
   - 「M5StickCplus2に接続」ボタンをクリック
   - デバイス選択画面で「M5StickCplus2-Controller」を選択
   - 接続が成功すると、リアルタイムでセンサーデータが表示されます

4. **操作確認**
   - ボタンA/Bを押して、画面上で状態が変わることを確認
   - M5StickCplus2を傾けて、加速度センサーの値が変わることを確認
   - 画面上の青い点が動くことを確認

### トラブルシューティング

- **「Bluetoothの権限がありません」エラーが表示される場合**

  **macOSの場合:**
  1. システム設定（システム環境設定）を開く
  2. 「プライバシーとセキュリティ」を選択
  3. 左側のメニューから「Bluetooth」を選択
  4. ブラウザ（Chrome/Edge）にチェックを入れる
  5. ブラウザを完全に終了してから再起動
  6. 再度接続を試してください

  **Windowsの場合:**
  1. Windowsの設定を開く（Win + I）
  2. 「プライバシー」を選択
  3. 左側のメニューから「Bluetooth」を選択
  4. 「アプリがBluetoothにアクセスできるようにする」をオンにする
  5. ブラウザを完全に終了してから再起動
  6. 再度接続を試してください

  **Linuxの場合:**
  1. Bluetoothサービスが起動しているか確認:
     ```bash
     sudo systemctl status bluetooth
     ```
  2. 必要に応じてBluetoothサービスを起動:
     ```bash
     sudo systemctl start bluetooth
     ```
  3. ブラウザを再起動してから再度接続を試してください

  **共通の確認事項:**
  - Chrome、Edge、またはOperaブラウザを使用しているか確認
  - `http://localhost:3000` または `https://` で始まるURLでアクセスしているか確認
  - ブラウザのアドレスバー左側の鍵アイコンをクリックしてBluetooth権限を確認
  - ブラウザを完全に終了してから再起動

- **デバイスが見つからない場合**
  - M5StickCplus2がBLEでアドバタイズしているか確認（画面に「BLE Ready」と表示されているか）
  - 他のデバイスと既に接続していないか確認
  - ブラウザのBluetooth権限を確認
  - M5StickCplus2を再起動（リセットボタンを押す）

- **接続エラーが発生する場合**
  - SERVICE_UUIDとCHARACTERISTIC_UUIDがArduino側とWeb側で一致しているか確認
  - ブラウザのコンソール（F12）でエラーメッセージを確認
  - M5StickCplus2の画面で接続状態を確認

- **データが送信されない場合**
  - M5StickCplus2の画面で接続状態を確認（「Connected」と表示されているか）
  - IMUセンサーが正しく初期化されているか確認
  - ブラウザのコンソールでエラーメッセージを確認

## 今後の進め方
1. `src/app/page.tsx` を編集して UI を実装
2. 必要に応じて `src/app` 以下にルートや API Route（App Router）を追加
3. Tailwind CSS のユーティリティを使ってスタイリング

Next.js の詳細は [公式ドキュメント](https://nextjs.org/docs) を参照してください。Vercel へのデプロイもシームレスに行えます。
