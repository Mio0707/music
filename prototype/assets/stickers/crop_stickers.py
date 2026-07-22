from pathlib import Path

from PIL import Image


ROOT = Path(__file__).parent


def crop_alpha(source: str, output: str, box: tuple[int, int, int, int] | None = None) -> None:
    image = Image.open(ROOT / source).convert("RGBA")
    if box is not None:
        image = image.crop(box)

    alpha_box = image.getchannel("A").getbbox()
    if alpha_box is None:
        raise ValueError(f"No visible pixels found in {source}")

    padding = 14
    left = max(0, alpha_box[0] - padding)
    top = max(0, alpha_box[1] - padding)
    right = min(image.width, alpha_box[2] + padding)
    bottom = min(image.height, alpha_box[3] + padding)
    image.crop((left, top, right, bottom)).save(ROOT / output, optimize=True)


performer_boxes = {
    "rabbit": (110, 0, 550, 610),
    "dog": (570, 0, 1190, 650),
    "cat": (80, 625, 650, 1210),
    "lion": (650, 640, 1190, 1210),
}

avatar_boxes = {
    "rabbit": (100, 80, 570, 640),
    "dog": (600, 130, 1160, 640),
    "cat": (90, 640, 610, 1130),
    "lion": (630, 630, 1160, 1140),
}

for animal, crop_box in performer_boxes.items():
    crop_alpha("performers-sheet.png", f"performer-{animal}.png", crop_box)

for animal, crop_box in avatar_boxes.items():
    crop_alpha("avatars-sheet.png", f"avatar-{animal}.png", crop_box)

crop_alpha("performer-bear.png", "performer-bear-cropped.png")
crop_alpha("avatar-bear.png", "avatar-bear-cropped.png")
