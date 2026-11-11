#!/usr/bin/env python3
"""Generate simple branded product PNGs for SokoOS demo tenants."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "uploads/samples")
OUT.mkdir(parents=True, exist_ok=True)

ITEMS = [
    ("sugar", "#C45C26", "Sugar 1kg"),
    ("rice", "#2F6F4E", "Rice 2kg"),
    ("oil", "#D4A017", "Cooking Oil"),
    ("soap", "#3D5A80", "Bar Soap"),
    ("flour", "#8B5E3C", "Maize Flour"),
    ("burger", "#B22222", "HW Burger"),
    ("fries", "#E09F3E", "Crispy Fries"),
    ("soda", "#1D3557", "Soda 500ml"),
    ("pizza", "#9B2226", "Margherita"),
    ("chicken", "#BC6C25", "Grilled Chicken"),
    ("salad", "#386641", "Garden Salad"),
    ("coffee", "#5C4033", "Americano"),
    ("scanner", "#E63946", "Voyager 1200g"),
    ("printer", "#457B9D", "Receipt Printer"),
]


def font(size: int):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make(slug: str, color: str, title: str) -> Path:
    img = Image.new("RGB", (640, 480), color)
    draw = ImageDraw.Draw(img)
    # soft overlay panel
    draw.rounded_rectangle((40, 140, 600, 360), radius=28, fill=(255, 255, 255, 230))
    draw.text((70, 190), "SokoOS", font=font(28), fill="#111111")
    draw.text((70, 240), title, font=font(42), fill="#111111")
    draw.text((70, 310), slug.upper(), font=font(22), fill="#555555")
    path = OUT / f"{slug}.png"
    img.save(path, "PNG", optimize=True)
    return path


def main() -> None:
    written = [str(make(s, c, t)) for s, c, t in ITEMS]
    print("\n".join(written))


if __name__ == "__main__":
    main()
