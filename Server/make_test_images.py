"""
model_CNN 테스트 이미지로 다중 음식 테스트 이미지 생성 (2x2 그리드, 7장)
"""

import os
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

TEST_DIR   = Path(__file__).parent.parent / "model_CNN" / "data" / "processed" / "test"
OUTPUT_DIR = Path(__file__).parent / "test_images"
OUTPUT_DIR.mkdir(exist_ok=True)

CELL_SIZE  = 500
GRID       = 2
NUM_IMAGES = 7
FOODS_PER  = 4
FONT_SIZE  = 24


def get_font():
    for path in ["C:/Windows/Fonts/malgun.ttf", "C:/Windows/Fonts/malgunbd.ttf"]:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, FONT_SIZE)
            except Exception:
                pass
    return ImageFont.load_default()


def collect_images():
    food_map = {}
    for cls_dir in TEST_DIR.iterdir():
        if not cls_dir.is_dir():
            continue
        imgs = list(cls_dir.glob("*.jpg")) + list(cls_dir.glob("*.png"))
        if imgs:
            food_map[cls_dir.name] = imgs
    return food_map


def make_grid(pairs, idx):
    total  = CELL_SIZE * GRID
    canvas = Image.new("RGB", (total, total), (240, 240, 240))
    draw   = ImageDraw.Draw(canvas)
    font   = get_font()

    for i, (food_name, img_path) in enumerate(pairs):
        row = i // GRID
        col = i  % GRID
        x   = col * CELL_SIZE
        y   = row * CELL_SIZE

        img = Image.open(img_path).convert("RGB")
        img = img.resize((CELL_SIZE, CELL_SIZE), Image.LANCZOS)
        canvas.paste(img, (x, y))

        label = food_name.replace("_", " ")
        bbox  = draw.textbbox((0, 0), label, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        pad = 6
        draw.rectangle([x+pad, y+pad, x+tw+pad*3, y+th+pad*3], fill=(0, 0, 0))
        draw.text((x+pad*2, y+pad*1.5), label, fill=(255, 255, 255), font=font)
        draw.rectangle([x, y, x+CELL_SIZE-1, y+CELL_SIZE-1],
                       outline=(180, 180, 180), width=2)

    out_path = OUTPUT_DIR / f"cnn_multi_{idx+1:02d}.jpg"
    canvas.save(out_path, quality=92)
    return out_path


def main():
    food_map = collect_images()
    foods    = list(food_map.keys())
    print(f"음식 클래스: {len(foods)}개\n")
    print(f"테스트 이미지 생성 중... ({NUM_IMAGES}장, 각 {FOODS_PER}개 음식)")

    for i in range(NUM_IMAGES):
        chosen = random.sample(foods, FOODS_PER)
        pairs  = [(name, random.choice(food_map[name])) for name in chosen]
        out    = make_grid(pairs, i)
        names  = ", ".join(n for n, _ in pairs)
        print(f"  [{i+1}] {out.name}  →  {names}")

    print(f"\n완료! {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
