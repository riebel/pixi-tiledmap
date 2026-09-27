"""Compose the article GIF from real captures (capture-browser.mjs, capture-tiled.ps1).

The map sits at the same pixel position in the Tiled and browser captures, so the
crossfades change only the tool around it. Drawn in post: header, labels, code
line, pointer, click ripples, the file chip, and the bridge outline.
"""
from pathlib import Path
import json
import re
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FR = ROOT / 'frames'
W, H = 1000, 792
BG, PANEL, LINE = '#0e1723', '#152131', '#2a3a4e'
GREEN, TEXT, DIM, FAINT = '#7de2b1', '#eef4fa', '#a1b3c8', '#5d6f86'
WIN_X, BAR_Y, STAGE_Y, STAGE_W, STAGE_H = 35, 64, 98, 930, 626
F = 'C:/Windows/Fonts/'
ui = ImageFont.truetype(F + 'segoeui.ttf', 17)
ui_bold = ImageFont.truetype(F + 'seguisb.ttf', 18)
brand = ImageFont.truetype(F + 'seguisb.ttf', 19)
mono = ImageFont.truetype(F + 'consola.ttf', 22)
mono_small = ImageFont.truetype(F + 'consola.ttf', 16)

# --- stage sources: identical map position (33, 60) in every capture --------
def tiled_stage(name):
    shot = Image.open(FR / name).convert('RGB')
    stage = Image.new('RGB', (STAGE_W, STAGE_H), PANEL)
    stage.paste(shot.crop((10, 106, 940, 150)), (0, 0))        # real toolbar
    stage.paste(shot.crop((498, 363, 1428, 945)), (0, 44))     # map view
    layers = shot.crop((1456, 152, 1990, 252))                 # Layers dock
    shadow = Image.new('L', (STAGE_W, STAGE_H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((372, 62, 372 + 534 + 12, 62 + 100 + 12), 8, fill=110)
    stage.paste(Image.new('RGB', stage.size, '#000'), (0, 0), shadow.filter(ImageFilter.GaussianBlur(8)))
    stage.paste(layers, (380, 64))
    ImageDraw.Draw(stage).rectangle((379, 63, 380 + 534, 64 + 100), outline='#4a5b70')
    return stage

def browser_stage(name):
    stage = Image.open(FR / name).convert('RGB').crop((85, 92, 85 + STAGE_W, 92 + STAGE_H))
    ImageDraw.Draw(stage).rectangle((0, 0, STAGE_W, 50), fill='#101b29')  # crop out the page heading
    return stage

layout = json.loads((FR / 'browser-layout.json').read_text())
def to_frame(x, y):  # page coordinates -> GIF coordinates
    return x - 85 + WIN_X, y - 92 + STAGE_Y
CLICKS = [to_frame(*c) for c in layout['clicks']]
bx, by, bw, bh = layout['button']
BUTTON = to_frame(bx + bw * 0.55, by + bh * 0.6)
BRIDGE = (WIN_X + 33 + 7 * 48, STAGE_Y + 60 + 6 * 48, WIN_X + 33 + 11 * 48, STAGE_Y + 60 + 7 * 48)

STAGES = {n: tiled_stage(n + '.png') for n in ('tiled-before', 'tiled-after', 'tiled-after-highlight')}
STAGES |= {n: browser_stage(n + '.png') for n in
           ('browser-0', 'browser-1', 'browser-2', 'browser-3', 'browser-4', 'browser-export')}
LABELS = {
    'tiled-before': ('Tiled', 'level.tmj', 'map editor'),
    'tiled-after': ('Tiled', 'level-edited.tmj', 'exported from the browser'),
    'tiled-after-highlight': ('Tiled', 'level-edited.tmj', 'View › Highlight Current Layer'),
}
for n in STAGES:
    LABELS.setdefault(n, ('Browser', 'PixiJS v8', 'localhost:4178'))

# --- drawing ---------------------------------------------------------------
CHIPS = ['Tiled', 'PixiJS', 'Tiled']
def chip_boxes():
    boxes, x = [], WIN_X
    probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    for i, label in enumerate(CHIPS):
        w = int(probe.textlength(label, font=ui_bold)) + 34
        boxes.append((x, 16, x + w, 48))
        x += w + (118 if i < 2 else 0)
    return boxes
CHIP_BOXES = chip_boxes()
ARROW_LABELS = ['load', 'export']

def header(d, active, fills):
    for i, (label, box) in enumerate(zip(CHIPS, CHIP_BOXES)):
        if i < 2:  # arrow to the next chip, filled by progress
            x0, x1, y = box[2] + 10, CHIP_BOXES[i + 1][0] - 14, 32
            d.line((x0, y, x1, y), fill=LINE, width=2)
            if fills[i] > 0:
                d.line((x0, y, x0 + (x1 - x0) * fills[i], y), fill=GREEN, width=2)
            d.polygon([(x1 + 8, y), (x1, y - 5), (x1, y + 5)], fill=GREEN if fills[i] >= 1 else LINE)
            tw = d.textlength(ARROW_LABELS[i], font=mono_small)
            d.text(((x0 + x1 - tw) / 2, 8), ARROW_LABELS[i], font=mono_small,
                   fill=GREEN if fills[i] > 0 else FAINT)
        on, done = i == active, i < active
        d.rounded_rectangle(box, 16, fill=GREEN if on else PANEL, outline=GREEN if (on or done) else LINE, width=2)
        tw = d.textlength(label, font=ui_bold)
        d.text(((box[0] + box[2] - tw) / 2, 19), label, font=ui_bold,
               fill='#0f2a20' if on else (TEXT if done else DIM))
    tw = d.textlength('pixi-tiledmap', font=brand)
    d.text((W - WIN_X - tw, 20), 'pixi-tiledmap', font=brand, fill=GREEN)

def window(frame, d, stage_name):
    d.rounded_rectangle((WIN_X - 1, BAR_Y - 1, WIN_X + STAGE_W, STAGE_Y + STAGE_H), 10, fill=PANEL, outline=LINE)
    tool, file, note = LABELS[stage_name]
    d.rounded_rectangle((WIN_X + 12, BAR_Y + 10, WIN_X + 24, BAR_Y + 22), 3,
                        fill=GREEN if tool == 'Browser' else '#89bdf8')
    d.text((WIN_X + 34, BAR_Y + 5), tool, font=ui_bold, fill=TEXT)
    x = WIN_X + 40 + d.textlength(tool, font=ui_bold)
    d.text((x, BAR_Y + 6), '·  ' + file, font=ui, fill=DIM)
    tw = d.textlength(note, font=ui)
    d.text((WIN_X + STAGE_W - 14 - tw, BAR_Y + 6), note, font=ui, fill=GREEN if '›' in note else FAINT)
    frame.paste(STAGES[stage_name], (WIN_X, STAGE_Y))

TOKEN = re.compile(r"//.*|'[^']*'|\b\d+\b|[A-Za-z_$][\w$]*|\s+|.")
KEYWORDS = {'const', 'await'}
def code_line(d, code, flash=None):
    x, y = WIN_X + 2, 744
    for token in TOKEN.findall(code):
        color = TEXT
        if token.startswith('//'): color = FAINT
        elif token.startswith("'"): color = '#a8d5a2'
        elif token in KEYWORDS: color = '#c3a6ef'
        elif token in {'loadTiledMapAsset', 'setTile', 'exportMap'}: color = '#e9ca83'
        elif token == '→': color = GREEN
        elif token.isdigit(): color = '#dfb78b'
        w = d.textlength(token, font=mono)
        if flash is not None and token == flash[0] and flash[1] > 0:
            a = flash[1]
            d.rounded_rectangle((x - 4, y - 3, x + w + 4, y + 25), 5, fill=_mix(BG, GREEN, 0.35 * a))
            color = _mix('#dfb78b', '#ffffff', a)
            flash = (None, 0)
        d.text((x, y), token, font=mono, fill=color)
        x += w

def _mix(a, b, t):
    a, b = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in (a, b)]
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

POINTER = [(0, 0), (0, 22), (5, 17), (9, 26), (13, 24), (9, 16), (16, 16)]
def pointer(d, x, y, pressed=0.0):
    s = 1 - 0.12 * pressed
    pts = [(x + px * s, y + py * s) for px, py in POINTER]
    d.polygon([(px + 2, py + 2) for px, py in pts], fill='#070b10')
    d.polygon(pts, fill='#ffffff', outline='#11161d', width=2)

def ripple(frame, x, y, t):
    over = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    r = 8 + 22 * t
    ImageDraw.Draw(over).ellipse((x - r, y - r, x + r, y + r), outline=(125, 226, 177, int(255 * (1 - t))), width=3)
    frame.alpha_composite(over)

def file_chip(frame, x, y, alpha=1.0):
    over = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    label = 'level-edited.tmj'
    w = d.textlength(label, font=mono_small) + 40
    a = int(255 * alpha)
    d.rounded_rectangle((x - w / 2, y - 15, x + w / 2, y + 15), 8, fill=(22, 36, 52, a), outline=(125, 226, 177, a), width=2)
    fx, fy = x - w / 2 + 12, y - 8  # document glyph
    d.polygon([(fx, fy), (fx + 9, fy), (fx + 13, fy + 4), (fx + 13, fy + 16), (fx, fy + 16)], fill=(125, 226, 177, a))
    d.text((x - w / 2 + 31, y - 9), label, font=mono_small, fill=(238, 244, 250, a))
    frame.alpha_composite(over)

def bridge_outline(frame, t):
    if t <= 0: return
    over = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    x0, y0, x1, y1 = BRIDGE
    g = 3 + 5 * (1 - t)
    ImageDraw.Draw(over).rounded_rectangle((x0 - g, y0 - g, x1 + g, y1 + g), 6,
                                           outline=(125, 226, 177, int(255 * t)), width=3)
    frame.alpha_composite(over)

def render(s):
    frame = Image.new('RGBA', (W, H), BG)
    d = ImageDraw.Draw(frame)
    header(d, s['active'], s.get('fills', (0, 0)))
    window(frame, d, s['stage'])
    d = ImageDraw.Draw(frame)
    code_line(d, s['code'], s.get('flash'))
    bridge_outline(frame, s.get('outline', 0))
    if 'ripple' in s: ripple(frame, *s['ripple'])
    if 'chip' in s: file_chip(frame, *s['chip'])
    if 'pointer' in s: pointer(ImageDraw.Draw(frame), *s['pointer'])
    return frame.convert('RGB')

# --- timeline --------------------------------------------------------------
ease = lambda t: t * t * (3 - 2 * t)
lerp = lambda a, b, t: (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
frames, durations = [], []
def hold(s, ms): frames.append(render(s)); durations.append(ms)
def fade(a, b, n=6, ms=60, **tween):
    for i in range(1, n + 1):
        t = ease(i / (n + 1))
        mid = {k: tuple(x0 + (x1 - x0) * t for x0, x1 in zip(*v)) for k, v in tween.items()}
        fa, fb = render(a | mid), render(b | mid)
        # Only the stage blends; header, labels, and code switch at the midpoint.
        frame = (fa if t < 0.5 else fb).copy()
        box = (WIN_X, STAGE_Y, WIN_X + STAGE_W, STAGE_Y + STAGE_H)
        frame.paste(Image.blend(fa.crop(box), fb.crop(box), t), box[:2])
        frames.append(frame); durations.append(ms)

CODE_START = "// level.tmj, authored in Tiled. Its Bridge layer is empty."
CODE_LOAD = "const { container: map } = await loadTiledMapAsset('./level.tmj')"
CODE_SET = "map.setTile('Bridge', {col}, 6, {{ tileset: 'platformer', tileId: 4 }})"
CODE_EXPORT = "exportMap(map.mapData)  →  level-edited.tmj"
CODE_END = "// Back in Tiled: the four tiles are on the Bridge layer."

start = {'stage': 'tiled-before', 'active': 0, 'code': CODE_START}
hold(start, 2000)
loaded = {'stage': 'browser-0', 'active': 1, 'fills': (1, 0), 'code': CODE_LOAD}
fade(start, loaded, fills=((0, 0), (1, 0)))
hold(loaded, 1300)

pos = to_frame(760, 520)
for i, target in enumerate(CLICKS):
    col = 7 + i
    base = {'active': 1, 'fills': (1, 0), 'code': CODE_SET.format(col=col - 1 if i else 7)}
    before = f'browser-{i}'
    steps = 12 if i == 0 else 6
    for k in range(1, steps + 1):
        hold(base | {'stage': before, 'pointer': (*lerp(pos, target, ease(k / steps)), 0)}, 40)
    pos = target
    for k, t in enumerate((0.0, 0.33, 0.66, 1.0)):
        hold(base | {'stage': f'browser-{i + 1}', 'code': CODE_SET.format(col=col),
                     'flash': (str(col), 1 - t * 0.6), 'ripple': (*target, t),
                     'pointer': (*target, 1 if k < 2 else 0)}, 50)
    hold(base | {'stage': f'browser-{i + 1}', 'code': CODE_SET.format(col=col),
                 'flash': (str(col), 0.3), 'pointer': (*target, 0)}, 260)
edited = {'stage': 'browser-4', 'active': 1, 'fills': (1, 0), 'code': CODE_SET.format(col=10)}
hold(edited | {'pointer': (*pos, 0)}, 500)

exporting = {'stage': 'browser-4', 'active': 1, 'fills': (1, 0), 'code': CODE_EXPORT}
for k in range(1, 11):
    hold(exporting | {'pointer': (*lerp(pos, BUTTON, ease(k / 10)), 0)}, 40)
for k, t in enumerate((0.0, 0.33, 0.66, 1.0)):
    hold(exporting | {'stage': 'browser-export', 'ripple': (*BUTTON, t), 'pointer': (*BUTTON, 1 if k < 2 else 0)}, 50)
exported = exporting | {'stage': 'browser-export', 'pointer': (*BUTTON, 0)}
hold(exported, 300)
dest = ((CHIP_BOXES[2][0] + CHIP_BOXES[2][2]) / 2, 32)
lift = (BUTTON[0] - 60, BUTTON[1] - 50)
for k in range(1, 15):
    t = ease(k / 14)
    p = lerp(lerp(lift, (lift[0], dest[1] + 40), t), lerp((lift[0], dest[1] + 40), dest, t), t)
    hold(exported | {'fills': (1, t), 'chip': (*p, 1.0 if k < 12 else (14 - k) / 3 + 0.2)}, 45)
back = {'stage': 'tiled-after', 'active': 2, 'fills': (1, 1), 'code': CODE_END}
fade(exported | {'fills': (1, 1)}, back)
hold(back, 1000)
lit = back | {'stage': 'tiled-after-highlight'}
fade(back, lit, n=4, ms=70)
for k in range(1, 7):
    hold(lit | {'outline': ease(k / 6)}, 45)
hold(lit | {'outline': 1}, 2800)
fade(lit | {'outline': 1}, start, n=6, ms=70, fills=((1, 1), (0, 0)))

# --- encode ---------------------------------------------------------------
# One shared palette across all frames avoids palette flicker between scenes.
samples = [frames[i] for i in (0, 5, 8, 40, len(frames) // 2, len(frames) - 12, len(frames) - 3)]
sheet = Image.new('RGB', (W, H * len(samples)))
for i, f in enumerate(samples): sheet.paste(f, (0, H * i))
palette = sheet.quantize(colors=255, method=Image.Quantize.MEDIANCUT, kmeans=2)
indexed = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
out = ROOT / 'pixi-tiledmap-roundtrip.gif'
indexed[0].save(out, save_all=True, append_images=indexed[1:], duration=durations, loop=0, optimize=False, disposal=1)
for name, index in (('sheet-start', 0), ('sheet-edit', 40), ('sheet-end', len(frames) - 8)):
    frames[index].save(FR / f'{name}.png')
print(f'{out.name}: {len(frames)} frames, {sum(durations) / 1000:.1f}s, '
      f'{out.stat().st_size / 1024:.0f} KiB, {W}x{H}')

# --- dev.to cover (1000x420): the same map, half Tiled, half PixiJS ----------
def cover():
    cw, ch = 1000, 420
    img = Image.new('RGBA', (cw, ch), BG)
    d = ImageDraw.Draw(img)
    d.text((56, 70), 'pixi-tiledmap', font=ImageFont.truetype(F + 'seguisb.ttf', 22), fill=GREEN)
    title = ImageFont.truetype(F + 'seguisb.ttf', 50)
    d.text((54, 112), 'Tiled → PixiJS', font=title, fill=TEXT)
    d.text((54, 172), '→ Tiled', font=title, fill=TEXT)
    sub = ImageFont.truetype(F + 'segoeui.ttf', 21)
    for i, line in enumerate(('Load, edit, and export Tiled maps', 'at runtime, in TypeScript.')):
        d.text((56, 258 + i * 30), line, font=sub, fill=DIM)
    tiled = Image.open(FR / 'tiled-after.png').convert('RGB').crop((531, 379, 1395, 859))
    pixi = Image.open(FR / 'browser-4.png').convert('RGB').crop((118, 152, 982, 632))
    mw, mh = 540, 300
    tiled, pixi = (im.resize((mw, mh), Image.Resampling.LANCZOS) for im in (tiled, pixi))
    mask = Image.new('L', (mw, mh), 0)
    ImageDraw.Draw(mask).polygon([(mw * 0.62, 0), (mw, 0), (mw, mh), (mw * 0.38, mh)], fill=255)
    tiled.paste(pixi, (0, 0), mask)
    x0, y0 = cw - mw - 44, (ch - mh) // 2
    shadow = Image.new('L', (cw, ch), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((x0 - 4, y0 + 6, x0 + mw + 4, y0 + mh + 14), 12, fill=150)
    img.paste(Image.new('RGBA', (cw, ch), '#000'), (0, 0), shadow.filter(ImageFilter.GaussianBlur(14)))
    round_mask = Image.new('L', (mw, mh), 0)
    ImageDraw.Draw(round_mask).rounded_rectangle((0, 0, mw - 1, mh - 1), 10, fill=255)
    img.paste(tiled, (x0, y0), round_mask)
    d = ImageDraw.Draw(img)
    d.line((x0 + mw * 0.62, y0, x0 + mw * 0.38, y0 + mh), fill=GREEN, width=3)
    for label, (lx, ly), anchor in (('Tiled', (x0 + 14, y0 + 12), 'la'), ('PixiJS', (x0 + mw - 14, y0 + 12), 'ra')):
        tw = d.textlength(label, font=ui_bold)
        bx0 = lx if anchor == 'la' else lx - tw - 20
        d.rounded_rectangle((bx0, ly, bx0 + tw + 20, ly + 30), 15, fill=BG)
        d.text((bx0 + 10, ly + 3), label, font=ui_bold, fill=GREEN)
    img.convert('RGB').save(ROOT / 'devto-cover.png')
    print('devto-cover.png: 1000x420')

cover()
