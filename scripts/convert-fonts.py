#!/usr/bin/env python3
"""Convert the full fonts without subsetting.

Requires Python 3 and fonttools[woff]==4.60.2 (including Brotli).
Run from any directory: python scripts/convert-fonts.py
"""
from pathlib import Path

from fontTools.ttLib import TTFont

fonts = Path(__file__).resolve().parent.parent / "public" / "fonts"
for name in ("Manrope-Variable", "Jost-Regular", "DMMono-Regular"):
    with TTFont(fonts / f"{name}.ttf", recalcTimestamp=False) as font:
        font.flavor = "woff2"
        font.save(fonts / f"{name}.woff2")
