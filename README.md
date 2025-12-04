# 社内チャットアプリ

リアルタイムチャット機能を持つWebアプリケーション

## 機能

- ✅ リアルタイムチャット（Socket.io使用）
- ✅ ファイル共有（画像・ファイル）
- ✅ メッセージ検索
- ✅ オンラインユーザー表示
- ✅ 通知機能
- ✅ メッセージ履歴の永続化
- ✅ 勤怠管理アプリへのリンク

## セットアップ方法

### ローカル環境

```bash
# 依存関係のインストール
npm install

# サーバー起動
npm start
```

ブラウザで `http://localhost:3000` にアクセス

### Render.comでのデプロイ

1. GitHubにコードをプッシュ
2. [Render.com](https://render.com/)でアカウント作成
3. 「New Web Service」を選択
4. GitHubリポジトリを接続
5. 以下の設定でデプロイ：
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

## 技術スタック

- **バックエンド**: Node.js + Express + Socket.io
- **フロントエンド**: HTML + CSS + JavaScript
- **ファイルアップロード**: Multer
- **リアルタイム通信**: Socket.io

## 作成者

AIエージェント勉強用プロジェクト
