#!/usr/bin/env python3
"""review.html から、claude.ai のリンク(Artifact)用のページを作る。

Artifact は公開時に <html><head><body> の外枠と、スマホの安全領域の余白を自分で付けるため、
外枠と二重になる余白をはずす。使い方: python3 tools/build-review-artifact.py <出力先.html>
"""
import re, sys
from pathlib import Path

src = (Path(__file__).resolve().parent.parent / "review.html").read_text(encoding="utf-8")
s = src[src.index("<title>"):]
for a, b in [
    ("</head>\n<body>\n", ""),
    ("</body>\n</html>\n", ""),
    ("#app{display:flex;flex-direction:column;height:100dvh;padding-top:env(safe-area-inset-top)}",
     "#app{display:flex;flex-direction:column;height:100%}\nhtml,body{height:100%;background:var(--sumi)}"),
    ("flex:none;padding-bottom:env(safe-area-inset-bottom);background:var(--sumi)}", "flex:none;background:var(--sumi)}"),
]:
    if a not in s:
        sys.exit(f"review.html の形が変わっています。この行が見つかりません: {a[:50]}")
    s = s.replace(a, b)
if re.search(r"<(html|body|head)[\s>]|<!DOCTYPE", s):
    sys.exit("外枠のタグが残っています")
Path(sys.argv[1]).write_text(s, encoding="utf-8")
print(f"書き出しました: {sys.argv[1]}({len(s):,} 文字)")
