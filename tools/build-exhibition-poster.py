from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "poster"
OUT.mkdir(parents=True, exist_ok=True)

SCALE = 2
W, H = 1080, 1920
CANVAS = (W * SCALE, H * SCALE)

FONT_REGULAR = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_LIGHT = "C:/Windows/Fonts/msyhl.ttc"


def sc(value):
    return int(round(value * SCALE))


def font(path, size):
    return ImageFont.truetype(path, sc(size))


F = {
    "tiny": font(FONT_REGULAR, 20),
    "small": font(FONT_REGULAR, 25),
    "small_bold": font(FONT_BOLD, 26),
    "body": font(FONT_REGULAR, 29),
    "label_body": font(FONT_REGULAR, 25),
    "body_bold": font(FONT_BOLD, 30),
    "label": font(FONT_BOLD, 32),
    "artist": font(FONT_BOLD, 46),
    "title_en": font(FONT_LIGHT, 32),
    "title": font(FONT_BOLD, 118),
    "caption": font(FONT_REGULAR, 24),
}


INK = (255, 244, 209)
MUTED = (222, 191, 135)
GOLD = (245, 191, 89)
GREEN = (134, 202, 123)
ROSE = (232, 118, 150)
BLUE = (104, 180, 214)
DEEP = (16, 10, 18)
PAPER = (252, 241, 214)
PAPER_INK = (44, 29, 28)


def cover(path, size):
    return ImageOps.fit(Image.open(path).convert("RGB"), size, method=Image.Resampling.LANCZOS)


def rounded(draw, xy, radius, fill, outline=None, width=1):
    xy = tuple(sc(v) for v in xy)
    draw.rounded_rectangle(xy, radius=sc(radius), fill=fill, outline=outline, width=sc(width))


def text_size(draw, text, fnt):
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def draw_text(draw, pos, text, fnt, fill, anchor=None, spacing=4, align="left"):
    x, y = pos
    draw.text((sc(x), sc(y)), text, font=fnt, fill=fill, anchor=anchor, spacing=sc(spacing), align=align)


def wrap_text(draw, text, fnt, max_width):
    max_width = sc(max_width)
    lines = []
    for para in text.split("\n"):
        current = ""
        for char in para:
            candidate = current + char
            if text_size(draw, candidate, fnt)[0] <= max_width or not current:
                current = candidate
            else:
                lines.append(current)
                current = char
        if current:
            lines.append(current)
    return lines


def draw_wrapped(draw, xy, text, fnt, fill, max_width, line_height, spacing_after=0):
    x, y = xy
    lines = wrap_text(draw, text, fnt, max_width)
    for line in lines:
        draw_text(draw, (x, y), line, fnt, fill)
        y += line_height
    return y + spacing_after


def draw_scanlines(draw):
    for y in range(0, H, 7):
        alpha = 28 if y % 14 == 0 else 12
        draw.line([(0, sc(y)), (sc(W), sc(y))], fill=(0, 0, 0, alpha), width=sc(1))


def paste_panel(base, path, box, opacity=1.0, tint=None, border=None):
    x1, y1, x2, y2 = [sc(v) for v in box]
    panel = cover(path, (x2 - x1, y2 - y1)).convert("RGBA")
    if tint:
        panel = Image.alpha_composite(panel, Image.new("RGBA", panel.size, tint))
    if opacity < 1:
        alpha = panel.getchannel("A").point(lambda value: int(value * opacity))
        panel.putalpha(alpha)
    base.alpha_composite(panel, (x1, y1))
    if border:
        ImageDraw.Draw(base, "RGBA").rectangle((x1, y1, x2, y2), outline=border, width=sc(2))


def paste_poly_panel(base, path, polygon, opacity=1.0, tint=None, border=None):
    xs = [point[0] for point in polygon]
    ys = [point[1] for point in polygon]
    box = (min(xs), min(ys), max(xs), max(ys))
    x1, y1, x2, y2 = [sc(v) for v in box]
    panel = cover(path, (x2 - x1, y2 - y1)).convert("RGBA")
    if tint:
        panel = Image.alpha_composite(panel, Image.new("RGBA", panel.size, tint))
    if opacity < 1:
        alpha = panel.getchannel("A").point(lambda value: int(value * opacity))
        panel.putalpha(alpha)

    mask = Image.new("L", panel.size, 0)
    local = [(sc(x - box[0]), sc(y - box[1])) for x, y in polygon]
    ImageDraw.Draw(mask).polygon(local, fill=int(255 * opacity))
    base.paste(panel, (x1, y1), mask)

    if border:
        draw = ImageDraw.Draw(base, "RGBA")
        scaled = [(sc(x), sc(y)) for x, y in polygon]
        draw.line(scaled + [scaled[0]], fill=border, width=sc(2))


def add_gradient_overlay(base):
    overlay = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    pix = overlay.load()
    for y in range(CANVAS[1]):
        top = y / CANVAS[1]
        alpha = int(58 + 126 * abs(top - 0.36))
        for x in range(CANVAS[0]):
            side = abs((x / CANVAS[0]) - 0.5) * 2
            pix[x, y] = (10, 7, 13, min(210, alpha + int(side * 70)))
    return Image.alpha_composite(base, overlay)


def build_collage_background():
    bg = Image.new("RGBA", CANVAS, (13, 9, 15, 255))
    assets = ROOT / "assets"
    pix = assets / "pixel-backgrounds"
    full = assets / "backgrounds"

    # A large day/night split establishes the conceptual contrast before the label.
    paste_poly_panel(
        bg,
        pix / "day1-network.png",
        [(0, 0), (620, 0), (500, 642), (0, 760)],
        tint=(255, 191, 89, 18),
        border=(245, 191, 89, 90),
    )
    paste_poly_panel(
        bg,
        full / "night4-intimacy.png",
        [(510, 0), (1080, 0), (1080, 742), (388, 626)],
        tint=(56, 20, 55, 38),
        border=(232, 118, 150, 82),
    )
    paste_poly_panel(
        bg,
        pix / "start.png",
        [(70, 390), (1010, 286), (1010, 626), (70, 604)],
        opacity=0.84,
        tint=(9, 7, 12, 88),
        border=(252, 232, 169, 72),
    )

    # Side contact sheets use actual game scenes as a designed frame.
    left_scenes = [
        pix / "day2-document.png",
        pix / "day3-room.png",
        pix / "day4-presentation.png",
        pix / "night1-family.png",
        pix / "night2-friend.png",
    ]
    right_scenes = [
        full / "night3-work.png",
        full / "night4-intimacy.png",
        full / "ending.png",
        pix / "day1-network.png",
        pix / "start.png",
    ]
    for idx, scene in enumerate(left_scenes):
        y1 = 632 + idx * 248
        paste_panel(bg, scene, (36, y1, 194, y1 + 214), opacity=0.9, tint=(8, 6, 10, 70), border=(245, 191, 89, 86))
    for idx, scene in enumerate(right_scenes):
        y1 = 592 + idx * 258
        paste_panel(bg, scene, (886, y1, 1046, y1 + 224), opacity=0.9, tint=(8, 6, 10, 82), border=(104, 180, 214, 74))

    # A dim lower band keeps the area behind the label related to the project without competing with text.
    paste_poly_panel(
        bg,
        full / "ending.png",
        [(0, 1430), (1080, 1282), (1080, 1920), (0, 1920)],
        opacity=0.82,
        tint=(7, 6, 11, 118),
        border=(245, 191, 89, 48),
    )

    # Thin crop strips create rhythm and make the collage intentional rather than a flat montage.
    strip_scenes = [
        pix / "night1-family.png",
        pix / "day4-presentation.png",
        full / "night2-friend.png",
        pix / "day3-room.png",
    ]
    for idx, scene in enumerate(strip_scenes):
        x1 = 228 + idx * 154
        paste_panel(bg, scene, (x1, 1502, x1 + 94, 1840), opacity=0.7, tint=(10, 7, 13, 112), border=(252, 232, 169, 48))

    bg = add_gradient_overlay(bg)
    bg = bg.filter(ImageFilter.UnsharpMask(radius=sc(0.6), percent=85, threshold=4))
    return bg


def main():
    image2_background = OUT / "image2-background.png"
    if image2_background.exists():
        poster = cover(image2_background, CANVAS).convert("RGBA")
        poster = Image.alpha_composite(poster, Image.new("RGBA", CANVAS, (8, 6, 12, 72)))
    else:
        poster = build_collage_background()
    draw = ImageDraw.Draw(poster, "RGBA")

    draw_scanlines(draw)

    rounded(draw, (38, 42, 1042, 1876), 0, None, (244, 190, 91, 190), 3)
    rounded(draw, (62, 70, 1018, 1848), 0, None, (252, 232, 169, 110), 1)

    draw_text(draw, (90, 118), "INTERACTIVE WEB GAME / CANVAS 2D", F["small"], MUTED)
    draw_text(draw, (90, 158), "白天解决问题，夜晚面对误解", F["small_bold"], INK)

    # Title block.
    draw_text(draw, (86, 236), "无法收敛", F["title"], INK)
    draw_text(draw, (94, 364), "Unable to Converge", F["title_en"], (231, 200, 151))
    draw_text(draw, (96, 430), "当语言进入他人的情绪函数，真实意图开始偏离预期输出。", F["body"], (255, 226, 170))

    # Exhibition label.
    rounded(draw, (72, 638, 1008, 1608), 16, PAPER, (242, 186, 101), 4)
    rounded(draw, (96, 666, 984, 1580), 8, None, (89, 58, 42), 2)

    x0 = 126
    y = 710
    draw_text(draw, (x0, y), "项目名称", F["label"], (98, 60, 37))
    draw_text(draw, (x0, y + 48), "无法收敛", F["artist"], PAPER_INK)
    draw_text(draw, (x0, y + 108), "艺术家：陈维隆", F["small"], (106, 77, 58))
    draw_text(draw, (x0, y + 146), "2D 叙事解谜网页游戏", F["caption"], (106, 77, 58))
    draw_text(draw, (x0, y + 180), "原生 HTML / CSS / JavaScript / Canvas 2D", F["caption"], (106, 77, 58))

    # QR block occupies an independent right column so the label text stays readable.
    qr = Image.open(ROOT / "游玩二维码链接.png").convert("RGB")
    qr = ImageOps.fit(qr, (sc(300), sc(300)), method=Image.Resampling.LANCZOS)
    rounded(draw, (650, 710, 954, 1074), 8, (255, 253, 247), (96, 64, 44), 2)
    poster.paste(qr, (sc(652), sc(728)))
    draw_text(draw, (802, 1040), "扫码进入作品", F["small_bold"], (98, 60, 37), anchor="mt")

    y = 1122
    draw.line([(sc(x0), sc(y - 18)), (sc(954), sc(y - 18))], fill=(116, 82, 61), width=sc(1))
    draw_text(draw, (x0, y), "设计思想", F["label"], (98, 60, 37))
    idea = (
        "作品把工程世界中的“输入、模型、输出”转译为亲密关系中的误解装置。"
        "白天，玩家修复网络、文档、房间与汇报，问题被拆解、验证并收敛；"
        "夜晚，语言进入他人的经验、偏见与情绪，被不可见的函数重新映射。"
        "越是试图解释，越显露系统的不可校准。\n"
        "游戏以白昼/夜晚的循环记录一场无法反向传播的沟通实验：表达清晰度、"
        "对方理解率、解释成本与自我保留度不断变化。它追问，当真实意图无法抵达"
        "预期输出时，停止解释是否也可以成为边界的重构。"
    )
    y = draw_wrapped(draw, (x0, y + 58), idea, F["label_body"], PAPER_INK, 806, 39)
    draw_text(draw, (126, 1538), "sh1nyyythu.github.io/unable-to-converge-game", F["caption"], (106, 77, 58))

    # Bottom caption outside the label.
    rounded(draw, (154, 1688, 926, 1786), 10, (16, 10, 15, 232), (244, 190, 91, 190), 2)
    draw_text(draw, (540, 1714), "在可优化的系统之外，关系仍以不可解释的方式运行。", F["small_bold"], INK, anchor="ma")
    draw_text(draw, (540, 1750), "A playable study of expression, misreading and boundaries.", F["small"], MUTED, anchor="ma")

    out_png = OUT / "unable-to-converge-exhibition-poster.png"
    out_pdf = OUT / "unable-to-converge-exhibition-poster.pdf"
    out_txt = OUT / "exhibition-label-copy.txt"

    rgb = poster.convert("RGB")
    rgb.save(out_png, quality=95)
    rgb.save(out_pdf, "PDF", resolution=300.0)
    out_txt.write_text(
        "项目名称：无法收敛\n"
        "艺术家名字：陈维隆\n\n"
        "设计思想：\n"
        f"{idea}\n",
        encoding="utf-8",
    )

    preview = rgb.resize((W, H), Image.Resampling.LANCZOS)
    preview.save(OUT / "unable-to-converge-exhibition-poster-preview.png", quality=92)

    print(out_png)
    print(out_pdf)
    print(out_txt)


if __name__ == "__main__":
    main()
