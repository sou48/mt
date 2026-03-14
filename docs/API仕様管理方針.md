# MT API 仕様管理方針

## 決定事項

- API 仕様書形式は OpenAPI 3.1 を採用する
- ただし初期移行期間は Markdown 仕様書と併用する
- 実装の JSON 契約は [API_JSON仕様](/home/takeshi/multi-translate/docs/API_JSON仕様.md) を正本とする

## 運用ルール

- API 追加、変更時は以下を同時に更新する
  - 実装コード
  - [バックエンド仕様](/home/takeshi/multi-translate/docs/バックエンド仕様.md)
  - [API_JSON仕様](/home/takeshi/multi-translate/docs/API_JSON仕様.md)
  - OpenAPI 定義
- 破壊的変更は、事前に JSON 契約差分を明示する
- 一覧 API のページネーションとエラー形式は全 API で共通化する

## 進め方

1. Markdown で仕様を先に合意する
2. JSON 契約を `API_JSON仕様.md` に固定する
3. OpenAPI 3.1 定義へ反映する
4. 実装と疎通確認を行う

## 現時点の扱い

- 本リポジトリでは OpenAPI 3.1 を正式採用と決定した
- OpenAPI ファイル自体の追加は後続作業とする
- 仕様変更レビュー時は Markdown と OpenAPI の整合を確認対象に含める
