# MT API JSON 仕様

## 目的

MT バックエンド API の request / response 形式を、実装と運用の両面で固定するための文書です。

## 共通方針

- リクエスト、レスポンスは JSON を基本とする
- 正常系は HTTP ステータスで結果を示し、本文には対象リソース名のキーを返す
- 異常系は `message` を必須で返す
- 一覧系は `pagination` を必須で返す
- 警告は処理成功と分けて `warnings` 配列で返す
- ID はすべて文字列として返す
- 日時は ISO 8601 文字列で返す

## 正常系の基本形

単体取得 / 作成 / 更新:

```json
{
  "company": {
    "id": "1",
    "name": "株式会社サンプル"
  }
}
```

一覧取得:

```json
{
  "companies": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "pageSize": 20,
    "totalPages": 0
  }
}
```

警告付き成功:

```json
{
  "project": {
    "id": "10",
    "name": "資材調達2026"
  },
  "warnings": [
    {
      "code": "PROJECT_SIMILAR_NAME",
      "message": "類似した案件名の候補があります。",
      "currentName": "資材調達2026",
      "matchedName": "資材調達2025"
    }
  ]
}
```

削除や副作用のみ:

```json
{
  "ok": true
}
```

## 異常系の基本形

```json
{
  "message": "会社が見つかりません。"
}
```

## 一覧 API のページネーション

すべての一覧 API は以下の query を受け付けます。

- `page`
  - 1 始まり
  - 未指定時は `1`
- `pageSize`
  - 未指定時は `20`
  - 上限は `100`

対象:

- `GET /api/companies`
- `GET /api/projects`
- `GET /api/messages`
- `GET /api/messages/:messageId/attachments`
- `GET /api/messages/:messageId/histories`
- `GET /api/signatures`
- `GET /api/signatures/:signatureId/histories`
- `GET /api/dictionaries/system`
- `GET /api/dictionaries/system/:entryId/histories`
- `GET /api/companies/:companyId/dictionaries`
- `GET /api/companies/:companyId/dictionaries/:entryId/histories`
- `GET /api/search/companies`
- `GET /api/search/projects`
- `GET /api/search/messages`
- `GET /api/admin/users`

## 主要レスポンスキー

- 認証:
  - `user`
- 会社:
  - `company`, `companies`
- 案件:
  - `project`, `projects`
- メッセージ:
  - `message`, `messages`
- 添付:
  - `attachment`, `attachments`
- 署名:
  - `signature`, `signatures`
- 辞書:
  - `entry`, `entries`
- 履歴:
  - `histories`
- 管理者ユーザー:
  - `user`, `users`

## 補足

- 検索 API も通常一覧と同じページネーション形式を使う
- 添付ダウンロードだけは JSON ではなくファイルレスポンスを返す
- 履歴 API は `snapshotJson` に更新前スナップショットを返す
- 今後 OpenAPI 定義を更新する場合も、この文書を JSON 契約の基準とする
