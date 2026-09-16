/* ================================================================
   soba-worker.js — 相場の中継サーバ(Cloudflare Worker)
   ----------------------------------------------------------------
   値付け帳(nezuke.html)から呼ぶための、ごく小さな中継です。
   ブラウザから商品検索APIを直接叩けない理由は2つあります。

     1. CORS — APIがブラウザからの読み取りを許していない
     2. APIキー — HTMLに書くと、見た人全員に盗まれる

   この中継が、その2つを引き受けます。キーはWorkerの秘密として持ち、
   ブラウザには「価格の配列」だけを返します。

   ■ 置きかた(10分)
     1. npm i -g wrangler && wrangler login
     2. wrangler init soba-relay      (このファイルを src/index.js に置く)
     3. キーを秘密として登録(使うものだけでOK)
          wrangler secret put YAHOO_APPID     # https://e.developer.yahoo.co.jp/register
          wrangler secret put RAKUTEN_APPID   # https://webservice.rakuten.co.jp/
     4. wrangler deploy
     5. 出てきたURL(https://soba-relay.<自分>.workers.dev)を
        値付け帳の 設定 →「相場の取り込み」に貼る

   ■ 呼びかた
     GET /?q=ミュウ%20RGB&src=yahoo,rakuten&limit=30
     → {"q":"...","at":"...","items":[{"price":4180,"title":"...","shop":"...","src":"yahoo"}],
        "stats":{"n":12,"med":4180,"q1":3980,"q3":4480,"min":3800,"max":5200}}

   ■ 大事なこと
     ここで取れるのは「**ショップが売りに出している価格**」です。
     フリマで**実際に売れた価格**ではありません。ふつう2〜3割高く出ます。
     値付け帳は取り込んだ価格に印をつけ、混ざっていると警告します。
     メルカリ・ヤフオク等のスクレイピングは規約違反になるため、
     この中継には**入れていません**(足さないでください)。
   ================================================================ */

const ALLOW_ORIGIN = "*";          // 自分のサイトに限るなら、そのオリジンを書く
const CACHE_SEC    = 600;          // 同じ検索語は10分キャッシュ(APIに優しく、速い)
const MAX_LIMIT    = 50;

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (request.method !== "GET")     return err(405, "GETだけ受け付けます");

    const url = new URL(request.url);
    const q   = (url.searchParams.get("q") || "").trim();
    if (!q)            return err(400, "q(検索語)がありません");
    if (q.length > 80) return err(400, "検索語が長すぎます");

    const limit = Math.min(MAX_LIMIT, Math.max(1, +url.searchParams.get("limit") || 30));
    const src   = (url.searchParams.get("src") || "yahoo,rakuten")
                    .split(",").map(s => s.trim()).filter(Boolean);

    // 同じ問い合わせはキャッシュから返す(APIの回数制限を守るため)
    const key = new Request(`${url.origin}/?q=${encodeURIComponent(q)}&src=${src.join(",")}&limit=${limit}`, request);
    const hit = await caches.default.match(key);
    if (hit) return hit;

    const tasks = [];
    if (src.includes("yahoo")   && env.YAHOO_APPID)   tasks.push(yahoo(q, limit, env.YAHOO_APPID));
    if (src.includes("rakuten") && env.RAKUTEN_APPID) tasks.push(rakuten(q, limit, env.RAKUTEN_APPID));
    if (!tasks.length) return err(503, "使えるAPIキーが設定されていません(wrangler secret put で登録してください)");

    const settled = await Promise.allSettled(tasks);
    const items = [], failed = [];
    for (const s of settled) {
      if (s.status === "fulfilled") items.push(...s.value);
      else failed.push(String(s.reason && s.reason.message || s.reason));
    }
    if (!items.length) return err(502, failed.length ? "取得できませんでした: " + failed.join(" / ") : "見つかりませんでした");

    items.sort((a, b) => a.price - b.price);
    const body = {
      q, at: new Date().toISOString(),
      note: "ショップの販売価格です。フリマの実売価格ではありません。",
      items: items.slice(0, limit * 2),
      stats: stats(items.map(i => i.price)),
      failed: failed.length ? failed : undefined,
    };
    const res = cors(new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json;charset=utf-8", "cache-control": `public, max-age=${CACHE_SEC}` },
    }));
    ctx.waitUntil(caches.default.put(key, res.clone()));
    return res;
  },
};

/* ---- 各API(レスポンスの形が変わったら、この2つだけ直せば済みます) ---- */
async function yahoo(q, limit, appid) {
  const u = new URL("https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch");
  u.searchParams.set("appid", appid);
  u.searchParams.set("query", q);
  u.searchParams.set("results", String(Math.min(50, limit)));
  u.searchParams.set("sort", "+price");
  u.searchParams.set("in_stock", "true");
  const r = await fetch(u, { headers: { "user-agent": "soba-relay/1.0" } });
  if (!r.ok) throw new Error("Yahoo " + r.status);
  const j = await r.json();
  return (j.hits || []).map(h => ({
    price: +h.price, title: h.name || "", shop: (h.seller && h.seller.name) || "", src: "yahoo",
  })).filter(x => isFinite(x.price) && x.price > 0);
}
async function rakuten(q, limit, appid) {
  const u = new URL("https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601");
  u.searchParams.set("applicationId", appid);
  u.searchParams.set("keyword", q);
  u.searchParams.set("hits", String(Math.min(30, limit)));
  u.searchParams.set("sort", "+itemPrice");
  u.searchParams.set("availability", "1");
  const r = await fetch(u, { headers: { "user-agent": "soba-relay/1.0" } });
  if (!r.ok) throw new Error("Rakuten " + r.status);
  const j = await r.json();
  return (j.Items || []).map(w => w.Item || w).map(i => ({
    price: +i.itemPrice, title: i.itemName || "", shop: i.shopName || "", src: "rakuten",
  })).filter(x => isFinite(x.price) && x.price > 0);
}

/* ---- 中央値と四分位(値付け帳と同じ計算) ---- */
function stats(v) {
  const a = v.slice().sort((x, y) => x - y), n = a.length;
  if (!n) return { n: 0 };
  const q = p => { const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
                   return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo); };
  return { n, min: a[0], max: a[n - 1], q1: q(.25), med: q(.5), q3: q(.75) };
}
function cors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", ALLOW_ORIGIN);
  h.set("access-control-allow-methods", "GET,OPTIONS");
  h.set("access-control-allow-headers", "content-type");
  return new Response(res.body, { status: res.status, headers: h });
}
function err(status, message) {
  return cors(new Response(JSON.stringify({ error: message }), {
    status, headers: { "content-type": "application/json;charset=utf-8" },
  }));
}
