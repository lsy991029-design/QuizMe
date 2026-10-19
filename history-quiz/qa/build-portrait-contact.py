import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'src/data/people.json').read_text())
people = data.get('people', data.get('characters', []))
font = ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc', 20)
for page in range(4):
    sheet = Image.new('RGB', (1400, 1250), '#f6f3ec')
    draw = ImageDraw.Draw(sheet)
    for j, person in enumerate(people[page * 25:(page + 1) * 25]):
        x, y = (j % 5) * 280, (j // 5) * 250
        path = root / 'public/art/portraits' / f'{person["id"]}.webp'
        if path.exists():
            with Image.open(path) as im:
                assert im.size == (1024, 768), (path, im.size)
                sheet.paste(im.resize((280, 210), Image.Resampling.LANCZOS), (x, y))
        draw.text((x + 10, y + 218), f'{person["id"]} {person["name"]}', font=font, fill='#252722')
    sheet.save(root / f'qa/portraits-v11-contact-{page + 1}.jpg', quality=90)
print('Contact sheets created; checked image dimensions')
