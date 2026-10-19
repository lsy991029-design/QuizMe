from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
pages = [
    ('01-start.png', '01  开始测试'),
    ('02-quiz.png', '02  情境答题'),
    ('03-result.png', '03  人物结果'),
    ('04-share.png', '04  结果分享'),
]
width, gap, margin, heading = 390, 28, 36, 78
font = ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc', 25)
images = [Image.open(root / name).convert('RGB') for name, _ in pages]
heights = [round(image.height * width / image.width) for image in images]
sheet = Image.new('RGB', (margin * 2 + width * 4 + gap * 3, max(heights) + heading + margin), '#e9e3d9')
draw = ImageDraw.Draw(sheet)
for index, (image, (_, label)) in enumerate(zip(images, pages)):
    x = margin + index * (width + gap)
    draw.text((x, 28), label, font=font, fill='#58392f')
    sheet.paste(image.resize((width, heights[index]), Image.Resampling.LANCZOS), (x, heading))
sheet.save(root / 'mobile-flow-overview.jpg', quality=95, subsampling=0)
print(root / 'mobile-flow-overview.jpg')
