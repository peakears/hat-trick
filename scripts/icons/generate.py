"""Generates the Hat Trick app icon and splash artwork: "HT" on a blue LED dot-matrix scoreboard.

Original artwork (no league or team marks). Writes SVGs to assets/images/src/; render them to PNG
with `node scripts/icons/render.cjs` (needs Playwright). Run both after changing anything here.

    python3 scripts/icons/generate.py && node scripts/icons/render.cjs
"""

from pathlib import Path

SIZE = 1024
BACKGROUND = "#0d1420"  # also android.adaptiveIcon.backgroundColor and the splash background in app.json
LIT = "#60a5fa"  # the app's dark-mode accent
UNLIT = "#16243a"

# 5x7 dot-matrix letters.
LETTERS = {
    "H": ["X...X", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
    "T": ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
}


def dots(lit, unlit, scale):
    """Circles for "HT", centred on the canvas. Returns (lit circles, unlit circles)."""
    pitch, radius, space = 52 * scale, 21 * scale, 70 * scale
    glyph_width = 4 * pitch
    x0 = (SIZE - (2 * glyph_width + space)) / 2
    y0 = (SIZE - 6 * pitch) / 2
    on, off = [], []
    for i, letter in enumerate("HT"):
        ox = x0 + i * (glyph_width + space)
        for row, line in enumerate(LETTERS[letter]):
            for col, cell in enumerate(line):
                cx, cy = ox + col * pitch, y0 + row * pitch
                if cell == "X":
                    on.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{radius:.1f}" fill="{lit}"/>')
                elif unlit:
                    off.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{radius:.1f}" fill="{unlit}"/>')
    return "".join(on), "".join(off)


def svg(*, background, lit, unlit, glow, scale):
    on, off = dots(lit, unlit, scale)
    parts = []
    if glow:
        parts.append(
            '<defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%">'
            '<feGaussianBlur stdDeviation="14" result="b"/>'
            '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
        )
    if background:
        parts.append(f'<rect width="{SIZE}" height="{SIZE}" fill="{background}"/>')
    parts.append(off)
    parts.append(f'<g filter="url(#glow)">{on}</g>' if glow else on)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">{"".join(parts)}</svg>\n'


# The adaptive icon foreground is cropped and masked by the launcher (circle, squircle, ...): its
# content must fit the central safe zone, a circle 61% of the canvas wide. Scale 1.0 keeps the
# outermost dots inside it; the full icon and splash use 1.1.
OUTPUTS = {
    "icon": dict(background=BACKGROUND, lit=LIT, unlit=UNLIT, glow=True, scale=1.1),
    "adaptive-foreground": dict(background=None, lit=LIT, unlit=UNLIT, glow=True, scale=1.0),
    # Android 13+ themed icons: one colour on transparent; the launcher tints it.
    "adaptive-monochrome": dict(background=None, lit="#ffffff", unlit=None, glow=False, scale=1.0),
    "splash": dict(background=None, lit=LIT, unlit=UNLIT, glow=True, scale=1.1),
}

if __name__ == "__main__":
    out = Path(__file__).resolve().parents[2] / "assets" / "images" / "src"
    out.mkdir(parents=True, exist_ok=True)
    for name, options in OUTPUTS.items():
        (out / f"{name}.svg").write_text(svg(**options))
        print(f"wrote {out / name}.svg")
