#!/usr/bin/env node
// 機械チェック:AIの判定とは別に、規則で拾えるNGを毎回拾う。
// 使い方: node scripts/check.mjs <記事.md> [--reviews inputs/reviews/<スラッグ>.md] [--unused] [--strict-num] [--json]
// 終了コード: 0 = NGなし(注意はあり得る) / 1 = NGあり / 2 = 使い方の誤り
// 規則は review.html の localCheck と同じ。片方を直したら、もう片方も直す。
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--reviews");
if (!file) {
  console.error("使い方: node scripts/check.mjs <記事.md> [--reviews <レビュー.md>] [--unused] [--strict-num] [--json]");
  process.exit(2);
}
const read = (p) => { try { return readFileSync(p, "utf8"); } catch { console.error(`読めません: ${p}`); process.exit(2); } };
const draft = read(file);
const revFile = opt("--reviews");
const revAll = revFile ? read(revFile) : "";
// レビュー本文は「# 星2〜3のレビュー」見出しより後ろ。見出しがなければファイル全体
const mark = revAll.search(/^#\s*星2/m);
const reviews = mark >= 0 ? revAll.slice(mark).replace(/^#.*$/m, "") : revAll;
const unused = args.includes("--unused");
const strictNum = args.includes("--strict-num");

const RULES = [
  { re: /絶対|必ず|誰でも|確実に|100\s*[%％]|間違いなく|保証します/g, msg: "断定表現" },
  { re: /最新|今月|今年|今なら|期間限定|20\d\d年/g, msg: "時事表現" },
  { re: /No\.?\s*1|ナンバーワン|ナンバー1|業界一|日本一|最安|最高峰|一番売れ/gi, msg: "最上級・優良誤認のおそれ(景表法)" },
  { re: /治る|治す|治療|効く|効きます|効果があ|痩せ|腰痛が(消|治|なく|改善)|肩こりが(消|治|なく|改善)|歯周病を|虫歯を防|医師も/g, msg: "健康・医療の効果(薬機法のおそれ)" },
];
const FAKE_EXP = /使ってみ(た|ました|ると)|(私|筆者|僕|わたし)(も|が|は)(使って(い(ます|る)|みた)|使いました|使っています|買いました|購入しました|試しました)|愛用|買ってみ|実際に試し(た|ました|てみ)|我が家では|【体験を追記】/g;
const NUM_RE = /\d[\d,.]*\s*(%|％|時間|分|秒|ヶ月|か月|カ月|年|kg|g|W|dB|円|cm|mm|L|畳|回)/g;

const norm = (s) => String(s || "").replace(/\s+/g, "");
const uniq = (a) => [...new Set(a)];
const ctx = (h) => { const i = draft.indexOf(h); return i < 0 ? h : draft.slice(Math.max(0, i - 12), i + h.length + 12).replace(/\n/g, " "); };

const out = [];
if (!/広告|PR|プロモーション/.test(draft.slice(0, 300))) out.push({ lv: "ng", msg: "冒頭にPR表記がありません" });
for (const r of RULES) for (const h of uniq(draft.match(r.re) || [])) out.push({ lv: "ng", msg: r.msg, hit: ctx(h) });
if (unused) for (const h of uniq(draft.match(FAKE_EXP) || [])) out.push({ lv: "ng", msg: "未使用なのに使ったように読める", hit: ctx(h) });

const src = norm(reviews), dn = norm(draft);
if (src.length >= 25) {
  const hits = [];
  for (let i = 0; i + 25 <= dn.length; i += 5) {
    const s = dn.substr(i, 25);
    if (src.includes(s) && !hits.includes(s)) { hits.push(s); i += 20; }
  }
  if (hits.length) out.push({ lv: "ng", msg: `レビュー本文の丸写し(${hits.length}か所)`, hit: hits[0] + "…" });
}
if (revFile) {
  const basis = norm(revAll);
  const nums = uniq(draft.match(NUM_RE) || []).filter((n) => !basis.includes(norm(n)));
  if (nums.length) out.push({ lv: strictNum ? "ng" : "warn", msg: "レビュー・商品情報に見当たらない数字", hit: nums.slice(0, 6).join(" / ") });
} else {
  out.push({ lv: "warn", msg: "--reviews がないため、丸写しと数字の根拠は確かめていません" });
}
const len = draft.replace(/\s/g, "").length;
if (len < 1500) out.push({ lv: "warn", msg: `本文が短め(${len}字)。目安は2,000〜3,000字` });

const ng = out.filter((x) => x.lv === "ng").length;
if (args.includes("--json")) {
  console.log(JSON.stringify({ file, ng, warn: out.length - ng, issues: out }, null, 2));
} else {
  console.log(`機械チェック: ${file}`);
  console.log(ng ? `結果: NG ${ng} 件(要修正)` : "結果: NGなし");
  for (const x of out) console.log(`- [${x.lv === "ng" ? "NG" : "注意"}] ${x.msg}${x.hit ? `:「${x.hit}」` : ""}`);
}
process.exit(ng ? 1 : 0);
