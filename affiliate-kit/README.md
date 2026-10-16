# 買う前ノート — Claude Code 版キット

`review.html`(スマホの台帳)と同じ流れを、Claude Code のサブエージェント4人で回すためのフォルダです。
**書く役(writer)と落とす役(checker)を別ファイル・別の文脈に分け**、最後の押印と公開は人がします。

```
affiliate-kit/
├─ CLAUDE.md                 … 全体の運用ルール(順番・差し戻し・禁止事項)
├─ .claude/
│  ├─ agents/                … 4人の役割(Claude Code が自動で読むのはこの場所)
│  │  ├─ researcher.md  候補を選ぶ
│  │  ├─ planner.md     「買う前に知りたかったこと」5つ+設計図
│  │  ├─ writer.md      書く(採点しない)
│  │  └─ checker.md     落とす(書き直さない)
│  ├─ commands/daily.md      … /daily で1日分を実行
│  └─ settings.json          … 外部通信・削除・inputs の書き換えを禁止
├─ rules/
│  ├─ ng-expressions.md      … NG表現と言い換え
│  └─ brake.md               … 本数・扱わないジャンル・必ず人間確認にするジャンル
├─ scripts/check.mjs         … 機械チェック(AIの判定とは別に毎回走る)
├─ inputs/reviews/           … 人が集めたレビュー(_template.md をコピーして使う)
├─ inputs/asp/               … ASP管理画面から書き出した案件一覧(任意)
└─ output/{research,plan,draft,check,final}/
```

## 準備(初回だけ)

1. Node.js を入れる
2. `npm install -g @anthropic-ai/claude-code`
3. このフォルダで `claude` を起動し、ログインする

## 毎日の使い方

1. 販売ページで星2〜3に絞り、レビューを `inputs/reviews/<スラッグ>.md` に貼る(`_template.md` をコピー)
   - 「筆者の使用」を正直に書く。使っていないなら「使っていない」のまま
2. `claude` を起動して `/daily` と入力(本数を指定するなら `/daily 1`)
3. 報告を読み、`output/final/` の記事を自分で読む
   - 価格・仕様は公式で確かめる / リンクを差し込む / 「人間確認」の理由を読む
4. 公開は自分の手で行う(このキットは外へ投稿しません)

機械チェックだけ単体で回す:

```
node scripts/check.mjs output/draft/2026-10-16_rx-1-robot.md --reviews inputs/reviews/rx-1-robot.md --unused
```

## 毎朝自動で回したい場合

`CLAUDE.md` に「毎朝8時」と書いても、それだけでは動きません。時刻で起動する仕組みが別に要ります。
まず対話モードで `/daily` を何日か回し、許可の確認が出ないことを確かめてから、cron(Mac/Linux)などに載せます。

```
# 例:平日の朝7:50に1本(パスは自分の環境に合わせる)
50 7 * * 1-5 cd ~/affiliate-kit && claude -p "/daily 1" >> output/daily.log 2>&1
```

## 元の記事の手順から変えたところ(と理由)

| 元の手順 | このキット | 理由 |
|---|---|---|
| `/agents/*.md` に置く | `.claude/agents/*.md`(先頭に name/description) | Claude Code がサブエージェントとして読むのはこの場所と形式 |
| 「毎朝8時に実行」と CLAUDE.md に書く | cron などで `claude -p` を起動 | CLAUDE.md は指示書で、時計ではない |
| リサーチ担当が ASP を巡回 | 人が書き出した一覧を読むだけ | ASP はログインが要り、承認率は管理画面にしかない。AIに任せると数字を作りがち |
| 【体験を追記】を3か所 | 使ったことがある時だけ。未使用なら「未使用」と明記 | 使っていない商品を使ったように書くと、読者を誤認させる |
| (記載なし) | 1行目にPR表記 | 2023年10月からステルスマーケティングは景品表示法の規制対象 |
| レビューを貼って見出しに | 要約のみ、20字超の丸写しは機械で落とす | 著作権と販売サイトの規約 |
| 検品はAIのみ | AI検品+機械チェック(`check.mjs`)の厳しい方 | AIは迷うと通す側に倒れやすい。規則で拾えるものは規則で拾う |
| 差し戻し3回 | 2回 | 3回目で通る記事は、たいてい元の設計がずれている |
