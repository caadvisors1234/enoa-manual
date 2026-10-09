"""画面写真に width・height 属性を付ける。

docs/img/sizes.json（tools/capture.mjs が書く）の大きさを使う。
実際の画面と同じ大きさで表示されるので、写真の中の文字が読みやすい。
"""

import json
import re
from pathlib import Path

_IMG = re.compile(r'<img\b([^>]*?)\bsrc="([^"]*img/([^"]+\.webp))"([^>]*)>')
_sizes = {}


def on_config(config):
    path = Path(config["docs_dir"]) / "img" / "sizes.json"
    _sizes.clear()
    if path.exists():
        _sizes.update(json.loads(path.read_text(encoding="utf-8")))
    return config


def on_page_content(html, **kwargs):
    def add_size(match):
        before, src, name, after = match.groups()
        size = _sizes.get(name)
        if not size or "width=" in before + after:
            return match.group(0)
        return f'<img{before}src="{src}" width="{size[0]}" height="{size[1]}"{after}>'

    return _IMG.sub(add_size, html)
