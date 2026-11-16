# Builds the three CrazyGames covers from the key art in art/ next to this file, adding the game's
# title in its own Orbitron lettering. The key art was painted with Pixa (Flux 2 Max) without text.
#
#   python platform/crazygames/covers/mkcovers.py
#
# Writes platform/crazygames/store/cover-landscape-1920x1080.png, cover-portrait-800x1200.png and
# cover-square-800x800.png. The title stays clear of the top-left corner, where CrazyGames puts labels.
# Needs Pillow, and fontTools with brotli to read the game's woff2 font.
import io, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
STORE = os.path.join(HERE, '..', 'store')
WHITE, AMBER = (233, 236, 239), (255, 192, 74)


def orbitron(size):
    f = TTFont(os.path.join(ROOT, 'fonts', 'orbitron.woff2'))
    f.flavor = None
    buf = io.BytesIO(); f.save(buf); buf.seek(0)
    font = ImageFont.truetype(buf, size)
    try:
        font.set_variation_by_axes([900])
    except Exception:
        pass
    return font


def fit(src, w, h, crop=(0, 0, 0, 0)):
    """Scale and centre-crop src to w x h. crop trims shares of each edge first (left, top, right, bottom)."""
    im = Image.open(src).convert('RGB')
    W, H = im.size
    im = im.crop((int(W * crop[0]), int(H * crop[1]), int(W * (1 - crop[2])), int(H * (1 - crop[3]))))
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def shade(im, box, strength=0.75, vertical=True):
    """Darken towards one side of box so the title reads over a busy picture."""
    x0, y0, x1, y1 = box
    g = Image.new('L', (x1 - x0, y1 - y0))
    for i in range(g.height if vertical else g.width):
        t = i / ((g.height if vertical else g.width) - 1)
        v = int(255 * strength * (t ** 1.4 if vertical else (1 - t) ** 1.4))
        if vertical:
            g.paste(v, (0, i, g.width, i + 1))
        else:
            g.paste(v, (i, 0, i + 1, g.height))
    dark = Image.new('RGB', g.size, (5, 7, 10))
    im.paste(dark, (x0, y0), g)


def title(im, x, y, size, align='left'):
    """TALON over STRIKE with a soft shadow and a dark outline, like the game's title screen."""
    font = orbitron(size)
    lines = [('TALON', WHITE), ('STRIKE', AMBER)]
    gap = int(size * 1.05)
    widths = [font.getbbox(t)[2] for t, _ in lines]
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d, ds = ImageDraw.Draw(layer), ImageDraw.Draw(shadow)
    for i, (t, col) in enumerate(lines):
        tx = x if align == 'left' else x - widths[i] // 2
        ty = y + i * gap
        ds.text((tx + size * 0.05, ty + size * 0.07), t, font=font, fill=(0, 0, 0, 230))
        d.text((tx, ty), t, font=font, fill=col + (255,), stroke_width=max(2, size // 28), stroke_fill=(5, 7, 10, 255))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.06))
    out = Image.alpha_composite(im.convert('RGBA'), shadow)
    return Image.alpha_composite(out, layer).convert('RGB')


art = lambda n: os.path.join(HERE, 'art', n)
os.makedirs(STORE, exist_ok=True)

# Landscape: the helicopter on the right, the title low on the left over the smoke.
# A light trim from the right and bottom takes off the painter's mark in that corner.
im = fit(art('keyart-landscape.jpg'), 1920, 1080, crop=(0, 0, 0.03, 0.04))
shade(im, (0, 0, 980, 1080), 0.8, vertical=False)
shade(im, (0, 640, 1920, 1080), 0.55)
im = title(im, 90, 700, 150)
im.save(os.path.join(STORE, 'cover-landscape-1920x1080.png'), optimize=True)

# Portrait: the helicopter fills the top, the title sits on the battlefield at the bottom.
im = fit(art('keyart-portrait.jpg'), 800, 1200)
shade(im, (0, 820, 800, 1200), 0.85)
im = title(im, 400, 910, 118, align='center')
im.save(os.path.join(STORE, 'cover-portrait-800x1200.png'), optimize=True)

# Square: as the portrait, with a smaller title.
im = fit(art('keyart-square.jpg'), 800, 800, crop=(0, 0, 0.02, 0.02))
shade(im, (0, 520, 800, 800), 0.85)
im = title(im, 400, 570, 92, align='center')
im.save(os.path.join(STORE, 'cover-square-800x800.png'), optimize=True)
print('covers written to', os.path.abspath(STORE))
