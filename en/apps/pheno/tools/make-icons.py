"""Regenerate app icons from tools/icon-source.png (Pheno logo: hand with strawberry). Run: python3 tools/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
out = root / 'assets/icons'
src = Image.open(root / 'tools/icon-source.png').convert('RGB')
BG = tuple(sum(src.getpixel(p)[i] for p in [(5, 5), (1248, 5), (5, 1248), (1248, 1248)]) // 4 for i in range(3))

def square(size):
    return src.resize((size, size), Image.LANCZOS)

square(512).save(out / 'icon-512.png', optimize=True)
square(192).save(out / 'icon-192.png', optimize=True)
square(180).save(out / 'apple-touch-icon.png', optimize=True)

# Maskable: keep the artwork inside the central 80 % safe zone.
canvas = Image.new('RGB', (512, 512), BG)
inner = square(int(512 * 0.8))
canvas.paste(inner, ((512 - inner.width) // 2,) * 2)
canvas.save(out / 'icon-maskable-512.png', optimize=True)

# Header mark: rounded tile so the light artwork sits cleanly on the dark header.
mark = square(192).convert('RGBA')
mask = Image.new('L', (192, 192), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, 191, 191), radius=44, fill=255)
mark.putalpha(mask)
mark.save(out / 'pheno-mark.png', optimize=True)
