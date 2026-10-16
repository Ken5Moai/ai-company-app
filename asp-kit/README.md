# AI社員4人キット(ASP案件・無料相談型)

「無料相談」「無料登録」が成果条件のASP案件で、リサーチ→企画→執筆→検品を
Claude Code のサブエージェント4人に分けて回すフォルダです。
物販レビュー記事のほうは [`../affiliate-kit/`](../affiliate-kit/README.md) です。

```
asp-kit/
├─ CLAUDE.md                 … 運用ルール(順番・差し戻し3回・絶対に守ること)
├─ .claude/
│  ├─ agents/researcher.md   … 案件を最大10件抽出(inputs/asp/ だけを見る)
│  ├─ agents/planner.md      … 設計図3本
│  ├─ agents/writer.md       … 記事1本(採点しない)
│  ├─ agents/checker.md      … 落とす(書き直さない)
│  ├─ commands/daily.md      … /daily で1日分を実行
│  └─ settings.json          … 外部通信・削除・inputs の書き換えを禁止
├─ rules/ng-expressions.md   … NG表現(金商法・職業安定法・保険の書き方を含む)
├─ rules/brake.md            … 扱わない分野・必ず人間確認の分野・本数
├─ scripts/check.mjs         … 機械チェック
├─ inputs/asp/               … ASP管理画面から書き出した案件一覧(_template.md を参照)
├─ inputs/experience.md      … 自分の本当の体験メモ
└─ output/{research,plan,draft,check,final}/
```

## 毎日の使い方

1. ASPの管理画面で案件を探し、`inputs/asp/` に一覧を置く(週1回の更新で十分)
2. 体験した案件があれば `inputs/experience.md` に書く
3. このフォルダで `claude` を起動し `/daily`
4. `output/final/`(または「人間確認」の理由)を読む。【体験を追記】があれば本当の体験を書く
5. LINE・ブログへの公開は自分の手で行う

## 貼り付けた元の手順から変えたところ

元のプロンプトはそのまま残し、足した行には「(追加)」、変えた行には「【変更】」と書いてあります。

| 元の手順 | このキット | 理由 |
|---|---|---|
| `/agents/*.md` | `.claude/agents/*.md`(先頭に name/description/tools) | Claude Code がサブエージェントとして別の文脈で動かすのはこの形式。同じ文脈だと「書く役」と「落とす役」が混ざる |
| リサーチ担当がASPを巡回して10件 | 人が置いた一覧から**最大**10件 | ASPはログインが要り、承認率は管理画面にしかない。AIに「10件」と言うと、足りない分を作りがち |
| 体験の段落と【体験を追記】3か所 | 体験メモがある案件だけ。ないときは「申し込みの流れ(公式の範囲)」 | 相談していない人が「相談してみた」と書くと、読者を誤認させる |
| (記載なし) | 1行目にPR表記 | 2023年10月からステマは景品表示法の規制対象 |
| `/output/...`(先頭にスラッシュ) | `output/...` | 先頭の `/` はPCのいちばん上のフォルダを指してしまう |
| 「人間確認」なら通知 | `output/check/` に理由を残し、最後の報告で知らせる | Claude Code は単体ではスマホに通知を送らない |
| 毎朝8時(CLAUDE.md に書く) | cron などで `claude -p "/daily"` を起動 | CLAUDE.md は指示書で、時計ではない |
| 検品はAIのみ | 機械チェック+AI検品の厳しい方 | 規則で拾えるもの(断定・時事・PR表記・利益の約束)は規則で拾う |

差し戻し3回は、元の手順の値のままにしています。

## 毎朝自動で回したい場合

まず対話モードで `/daily` を何日か回し、許可の確認で止まらないことを確かめてから:

```
# 平日の朝7:50(パスは自分の環境に合わせる)
50 7 * * 1-5 cd ~/asp-kit && claude -p "/daily" >> output/daily.log 2>&1
```
