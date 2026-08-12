#!/usr/bin/env python3
"""Trim the admin-insurance-reporting.tsx filter card to the shared filter set.

Removes these filter blocks (not in the insurance compliance spec):
  - Customer Select
  - Min Driven Hours
  - Max Driven Hours
  - Min Payment
  - Max Payment
  - Group By

Strategy: for each comment marker, find the FIRST <div> AFTER the comment
(the wrapping div), then depth-count from there to find its matching </div>,
then remove [comment_start, div_close_end).
"""
from pathlib import Path
import re

p = Path("/home/z/my-project/101drivers-frontend/src/components/pages/admin-insurance-reporting.tsx")
text = p.read_text(encoding="utf-8")

def remove_filter_block(text: str, comment_marker: str) -> tuple[str, int]:
    """Remove the comment + the <div>...</div> block that immediately follows it."""
    cmt_start = text.find(comment_marker)
    if cmt_start < 0:
        raise AssertionError(f"comment marker not found: {comment_marker!r}")
    # Find the first <div> AFTER the comment
    div_start = text.find('<div>', cmt_start + len(comment_marker))
    if div_start < 0:
        raise AssertionError(f"wrapping <div> not found after {comment_marker!r}")
    # Depth-count from div_start
    pos = div_start + len('<div>')
    depth = 1
    while depth > 0 and pos < len(text):
        next_open = text.find('<div', pos)
        next_close = text.find('</div>', pos)
        if next_close < 0:
            raise AssertionError(f"no closing </div> found for {comment_marker!r}")
        if next_open >= 0 and next_open < next_close:
            depth += 1
            pos = next_open + len('<div')
        else:
            depth -= 1
            pos = next_close + len('</div>')
    # Remove from comment start through end of wrapping div
    block_size = pos - cmt_start
    new_text = text[:cmt_start] + text[pos:]
    return new_text, block_size

removed = []
for marker in [
    "{/* Customer Select */}",
    "{/* Min Driven Hours */}",
    "{/* Max Driven Hours */}",
    "{/* Min Payment */}",
    "{/* Max Payment */}",
    "{/* Group By */}",
]:
    text, n = remove_filter_block(text, marker)
    removed.append((marker, n))
    print(f"[OK] removed {marker} ({n} chars)")

# Clean up any triple-blank-lines left behind
text = re.sub(r'\n[ \t]*\n[ \t]*\n[ \t]*\n+', '\n\n', text)

p.write_text(text, encoding="utf-8")
print(f"\n[DONE] File written. Removed {len(removed)} filter blocks.")
