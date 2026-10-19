"""Compose the reviewed generated portrait sheets into one labeled atlas."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
PEOPLE = json.loads((ROOT / 'outputs/history-quiz-v0.3/data/people.json').read_text())['people']
FONT = '/System/Library/Fonts/Supplemental/Songti.ttc'
INK = '#29241e'
RED = '#a73628'
MUTED = '#796d5d'
MARGIN = 100
CELL_W, IMAGE_H, CELL_H, GAP = 320, 480, 576, 24
WIDTH = MARGIN * 2 + CELL_W * 10 + GAP * 9
TOP = 340
HEIGHT = TOP + CELL_H * 10 + GAP * 9 + 150


def font(size, bold=False):
    return ImageFont.truetype(FONT, size, index=1 if bold else 3)


def center(draw, text, x, y, size, fill=INK, bold=False):
    draw.text((x, y), text, font=font(size, bold), fill=fill, anchor='mt')


def main():
    assert len(PEOPLE) == 100
    assert len({p['id'] for p in PEOPLE}) == 100
    paper = Image.open(ROOT / 'history-quiz/public/art/paper.png').convert('RGB')
    canvas = Image.new('RGB', (WIDTH, HEIGHT), '#f7f1e6')
    paper = paper.resize((1200, 1200), Image.Resampling.LANCZOS)
    for y in range(0, HEIGHT, paper.height):
        for x in range(0, WIDTH, paper.width):
            canvas.paste(paper, (x, y))
    draw = ImageDraw.Draw(canvas)
    draw.text((MARGIN, 64), '与古人同频', font=font(54, True), fill=RED)
    draw.text((MARGIN - 5, 140), '百位历史人物', font=font(118, True), fill=INK)
    draw.text((MARGIN + 3, 279), '宣纸水墨  ·  人物画像总览', font=font(32), fill=MUTED)
    draw.text((WIDTH - MARGIN, 177), '100', font=font(108, True), fill=RED, anchor='rt')
    draw.text((WIDTH - MARGIN, 289), 'H001 — H100', font=font(25), fill=MUTED, anchor='rt')
    draw.line((MARGIN, 324, WIDTH - MARGIN, 324), fill='#c9bcaa', width=2)

    manifest = []
    for batch in range(10):
        path = OUT / 'batches' / f'batch-{batch + 1:02d}.png'
        sheet = Image.open(path).convert('RGB')
        sw, sh = sheet.size
        for cell in range(10):
            idx = batch * 10 + cell
            person = PEOPLE[idx]
            source_col, source_row = cell % 5, cell // 5
            bounds = (
                round(source_col * sw / 5), round(source_row * sh / 2),
                round((source_col + 1) * sw / 5), round((source_row + 1) * sh / 2),
            )
            portrait = sheet.crop(bounds).resize((CELL_W, IMAGE_H), Image.Resampling.LANCZOS)
            mask = Image.new('L', portrait.size, 0)
            ImageDraw.Draw(mask).rectangle((12, 12, CELL_W - 13, IMAGE_H - 13), fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(8))
            row, col = divmod(idx, 10)
            x, y = MARGIN + col * (CELL_W + GAP), TOP + row * (CELL_H + GAP)
            canvas.paste(portrait, (x, y), mask)
            center(draw, person['name'], x + CELL_W / 2, y + 491, 37, bold=True)
            era = person['era'].split('，')[0]
            center(draw, person['id'], x + CELL_W / 2, y + 539, 21, fill=RED)
            center(draw, era, x + CELL_W / 2, y + 567, 21, fill=MUTED)
            manifest.append({
                'id': person['id'], 'name': person['name'], 'era': person['era'],
                'row': row + 1, 'column': col + 1,
                'sourceSheet': path.name, 'sourceCell': cell + 1,
                'sourceBounds': bounds,
            })

    footer_y = HEIGHT - 100
    draw.line((MARGIN, footer_y - 32, WIDTH - MARGIN, footer_y - 32), fill='#c9bcaa', width=2)
    draw.text((MARGIN, footer_y), '跨越千年，遇见不同的自己。', font=font(27), fill=INK)
    draw.text((WIDTH - MARGIN, footer_y), '历史人物艺术演绎  ·  按本地人物库编号排列', font=font(23), fill=MUTED, anchor='rt')

    full = OUT / '100位历史人物_水墨画像总览.png'
    canvas.save(full, optimize=True)
    canvas.save(OUT / '100位历史人物_水墨画像总览.jpg', quality=96, subsampling=0)
    preview = canvas.copy()
    preview.thumbnail((1800, 3300), Image.Resampling.LANCZOS)
    preview.save(OUT / '100位历史人物_预览.jpg', quality=94, subsampling=0)
    assert [p['id'] for p in manifest] == [p['id'] for p in PEOPLE]
    (OUT / 'manifest.json').write_text(json.dumps({
        'count': 100, 'columns': 10, 'rows': 10,
        'canvasSize': [WIDTH, HEIGHT], 'people': manifest,
        'sha256': hashlib.sha256(full.read_bytes()).hexdigest(),
    }, ensure_ascii=False, indent=2))
    print(json.dumps({'count': len(manifest), 'size': canvas.size, 'file': str(full)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
