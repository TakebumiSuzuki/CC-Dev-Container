---
name: compose-html-slides
description: Convert a structured Markdown narrative report into a single self-contained, presentation-style HTML deck (left nav + one-slide-at-a-time stage, charts from tables).
disable-model-invocation: true
---

# compose-html-slides: Markdown narrative → presentation HTML deck

## What this produces

A **single self-contained `.html` file** that opens by double-click — no build
step, no server, no bundled JS framework. The only external dependency is Google
Fonts (Inter). Layout:

- a fixed **left nav** listing every slide (chapter dividers styled as "Parts",
  content pages indented beneath them), and
- a scrollable **right stage** that shows exactly one slide at a time.

Each slide is **at least 16:9** (a minimum height derived from the content width)
and **grows taller when the content needs it**, so a dense slide simply scrolls
vertically rather than overflowing or shrinking the type. The reader moves with
the nav, the `←`/`→` keys, or `PageUp`/`PageDown`.

This is the HTML analogue of a PowerPoint deck: the same "one idea per slide,
chapter dividers between sections" rhythm, but editable as plain HTML/CSS.

## The two reference files — read them before building

Both live in `references/` next to this file. **In a single parallel batch (one
round-trip), Read both reference files together** before you build anything —
reading the template alone is not enough, since only the worked example shows the
charts fully populated with hand-computed geometry:

- **`references/template.html`** — the **design system + every component**, in a
  small skeleton deck. Its `<style>` block (the design tokens) and its `<script>`
  block are the **source of truth**: copy them **verbatim**. Its slides
  demonstrate one of each component (cover, chapter divider, stats, bars, line
  chart, donut, bullet/benchmark, callout, two-column, takeaways, Q&A). Build
  your deck by copying this file and replacing the example slides.
- **`references/example_deck.html`** — a **complete worked example** (an 18-slide
  FY2025 performance review) showing every component populated with real data and
  hand-computed charts. When you are unsure how a component should look fully
  filled in, read the matching slide here.

> The two files share the exact same `<style>`/`<script>`. If you ever change the
> design system, change it in one place and keep them in sync — but for normal
> use you only **copy**, never rewrite, the CSS/JS.

## Build procedure

1. **Read the whole Markdown first.** Map the structure before writing anything:
   the title block, every `##` section, which sections have `###` subsections,
   every table (and the data shape inside it), and the "Key Takeaways" /
   "Anticipated Q&A" sections. The HTML's structure should *mirror* the
   Markdown's heading structure — don't invent divisions the source lacks, and
   don't merge things it separates. The input is a `narrative.md` written to the
   shared pipeline format spec, `../compose-slide-narrative/references/narrative_format.md`
   (the same contract the upstream skill produces) — consult it if a section's
   structure is ambiguous.

2. **Copy `template.html`, then mutate it only with `Edit` — never `Write`.**
   - First: `cp references/template.html <out>.html` (a real, byte-for-byte copy).
   - **Bright-line rule: after that `cp`, the `Write` tool must never target the
     output file again — every later change is an `Edit`.** Re-`Write`-ing the
     whole file re-emits the ~300-line design system (`<style>` + `<script>`) from
     memory: it's slow and silently risks CSS/JS drift. If you catch yourself
     assembling the full file in a `Write`, stop — you've thrown away the copy.
   - You touch exactly **two regions, one `Edit` each**:
       1. **nav** — replace the template's `<ul id="navlist"> … </ul>` block.
       2. **slides** — replace from the first `<!-- ░░ COVER ░░ -->` section
          through the last `</section>` before `</main>`.
     Leave the shared `<defs>` SVG, and everything above `<main>` / below
     `</main>`, untouched. The `old_string` is the template's *existing* text
     (known and fixed); only your new content goes in `new_string`. The head,
     `<style>`, and `<script>` are never retyped.

3. **Split into pages (pptx mindset)** using the rules below, and build the nav
   to match.

4. **For each table, pick the chart** that fits its data shape (see the mapping),
   then **compute the geometry by hand** (see the recipes). Never eyeball a bar
   width or a donut arc — wrong numbers are the most common failure here.

5. **Carry every `Source:` line and `[needs-verification]` marker** to the right
   slide (see Fidelity).

6. **Verify** (see the checklist) and, if a browser is available, open it.

## Page-splitting rules (Markdown → slides)

The guiding idea: **one slide per `###`, one divider per `##`**, splitting
*more* rather than less. A deck of many small, legible slides beats a few dense
ones — exactly how you'd build a PowerPoint.

- **Cover** — build a leading cover slide from the title block (title, author/org,
  audience, duration, date) using `.cover` + `.kicker` + `h1` + `.lede` + `.meta`.
  It is slide 0 and starts with class `show`.
- **`##` section → a chapter-divider slide** (`<section class="slide chapter">`):
  a near-empty page showing only the section title (as `h1`), a `Part N` kicker,
  a one-line lede, and a big faded numeral watermark. This is the pptx
  "section header" slide. It gets a nav entry styled `class="part"`.
- **`###` subsection → one content slide.** Its prose becomes `.lede`/`.lede.sm`,
  its table becomes a chart. It gets a nav entry styled `class="sub"`.
- **A `##` with no `###`s** (e.g. a short "Executive Summary" or "Conclusion"):
  render its body as a single content slide. If it's purely a heading with a
  paragraph, you may merge it with its divider; if it has a table or a list,
  give it its own slide. Use judgement — favour clarity.
- **Key Takeaways → a takeaways slide** (`.takeaways`), optionally paired with a
  closing `.big-quote`.
- **Anticipated Q&A → a Q&A slide** (`.qa` with `.item`/`.q`/`.a`).
- **If a slide would overflow heavily**, split it into two (e.g. stats on one,
  the supporting bar chart on the next). More pages is the correct instinct.

**Nav contract:** every slide has **exactly one** `<a>` in `#navlist`, in slide
order, with `data-i` running `0,1,2,…` with no gaps. Chapter dividers use
`class="part"` (and a Roman numeral in `.n`); content slides use `class="sub"`.
The script auto-numbers the page footers, so you don't hand-write `NN / NN`.

## Table → chart mapping

Pick the component whose shape matches the data. The goal the user cares about:
**every table becomes a chart** unless a chart genuinely can't represent it.

| The table shows… | Use | Component |
| --- | --- | --- |
| A handful of headline KPIs (one number each) | **Stat band** | `.stats` (3 cols) / `.stats.four` (4) |
| One series across categories (e.g. revenue by practice) | **Horizontal bars** | `.barwrap` › `.bar` |
| One metric over time, where the *shape* of the trend matters (a dip-and-recover) | **Line chart** | `<svg class="linechart">` |
| Two periods compared per metric (FY24 vs FY25) | **Bars with a FY-tick + delta chip** | `.bar` + `.tick` + `.chip up/dn` |
| Parts of a whole (NPS mix, win/loss split) | **Donut** | `<svg>` + `.ring` + `.legend` |
| One headline number that needs emphasis as a "watch" item | **Callout** | `.callout` (big number + text) |
| Many metrics × {us / industry / top} benchmark | **Bullet chart** | `.bul` rows |
| A genuinely tabular matrix a chart would distort | A clean **styled table** | (build one in the deck's palette) |

Two visuals on one slide → wrap them in `.two` (two columns) or `.two.wide-left`.

## Chart-geometry recipes (compute, don't guess)

Show your arithmetic in your reasoning so it can be checked.

- **Horizontal bar** — `style="--w: P%"` where `P = value / max(values) × 100`.
  Use the data max as 100% by default. When the differences are small but you
  want to keep them honest (e.g. utilization all near 73–76%), keep the same
  `value%` scale and say so in the caption rather than zooming the axis (zooming
  exaggerates and misleads). Annotate each bar's true value in `.val` (with a
  `<small>` for secondary figures like YoY).

- **Donut** — the ring is a circle of radius `r=87`, so its circumference is
  `C = 2πr ≈ 547`. Each segment is
  `stroke-dasharray: <len> 547` where `len = share × 547`, and
  `stroke-dashoffset: -<cumulative length of all earlier segments>`.
  The first segment has offset `0`. **The segment lengths must sum to 547.**
  Put the total (e.g. "112 surveys" or "29% win rate") in `.donut .center`.

- **Line chart** (SVG `viewBox="0 0 560 240"`, baseline `y=195`) — choose a value
  window `[lo, hi]` that frames the data (not 0-based, so the movement is
  visible), then for each point `y = 195 − (value − lo)/(hi − lo) × 160`. Place
  x at evenly spaced columns (e.g. 80, 280, 480). Build the `.area` polygon as
  `baseline-left → each point → baseline-right`, the `.ln` polyline through the
  points, a `.dot` per point, a `.vlab` value label above each, and `.xlab`
  category labels under the baseline.
  The fill gradient `#lg` is defined **once globally** in a 0×0 `<defs>` SVG at
  the top of `<main>` (already in the template). Every line chart — no matter how
  many the deck has — just uses `class="area"` + `url(#lg)`; **never give a chart
  its own `<defs>` or a second gradient id.** Two `<svg>`s both declaring
  `id="lg"` is invalid HTML and the ids collide (a common multi-line-chart bug).

- **Bullet / benchmark row** (`.bul`) — for each metric pick a window `[lo, hi]`
  padding the three values, then `pos% = (value − lo)/(hi − lo) × 100` for each
  of `.mcg` (us), `.ind` (industry), `.topq` (top quartile). **Orient every row
  so "better" is rightward**: for lower-is-better metrics (e.g. attrition),
  invert with `pos% = 100 − pos%` so the best value still sits on the right; note
  that inversion in the row's `<small>` and the legend. The `.band` spans from the
  industry marker to the top-quartile marker (`left` = min of the two, `width` =
  their distance). Echo the raw numbers in `.vals` (us **bold** / industry / top).

- **Stat** — `<div class="num">42<span>%</span></div>` — the number in the body,
  the unit/suffix in the `<span>` (it renders smaller).

## Fidelity rules

These keep the deck trustworthy — the single most important property for an exec
readout.

- **Language follows the source.** If the report is in English, the slides
  (including UI chrome like the nav and "Part N") are in English. Don't translate
  unless asked.
- **Visualize tables; don't drop their data.** Every figure in the table should
  appear either in the chart or in its labels.
- **Keep `Source:` attributions.** Render each one as `<p class="src">Source:
  …</p>` on the same slide as the chart it backs. If a slide pulls from several
  files, join them with ` · `.
- **Preserve `[needs-verification]` markers.** Render them inline as
  `<span class="note">[needs verification]</span>` — visible but understated.
  Never silently "clean them up": their job is to show what isn't yet confirmed.
- **Never invent numbers, sources, or trends** the Markdown doesn't contain.

## Restyling via design tokens

Everything visual is centralized in `:root` so a restyle is a few-line change —
you should not be hunting through rules.

- **Type size — one master knob.** `--fs-scale` (default `1`) multiplies **every**
  font size at once. For a large room bump it to `1.1`; for a denser deck drop to
  `0.9`. To resize a single role instead, edit its own `--fs-*` token (e.g.
  `--fs-lede`, `--fs-h2`, `--fs-barname`). The tokens are grouped and commented
  (headings, body, chart elements, nav). **Never hard-code a `font-size` in px on
  a slide;** if you truly need a one-off, write `calc(<px> * var(--fs-scale))` so
  it still tracks the master knob.
- **Colour.** The palette lives in `:root` too (`--paper`, `--ink`, `--espresso`,
  `--crema`, `--terracotta`, `--olive`, …). Recolouring the deck = editing these.
- **Layout.** `--nav-w` (nav width), `--slide-max` (content width), `--slide-min-h`
  (the 16:9 floor), `--slide-pad`, `--fs-watermark`.

## Before you finish — verification checklist

- **Chrome is byte-identical:** the `<style>` and `<script>` blocks must exactly
  match `references/template.html` — you only `Edit`-ed nav + slides, never
  `Write`. Verify:
  ```
  for tag in style script; do
    diff <(awk -v t=$tag 'BEGIN{o="^<"t">$";c="^</"t">$"} $0~o{f=1} f{print} $0~c{f=0}' references/template.html) \
         <(awk -v t=$tag 'BEGIN{o="^<"t">$";c="^</"t">$"} $0~o{f=1} f{print} $0~c{f=0}' <out>.html) \
      && echo "$tag OK";
  done
  ```
  Any diff means the design system was re-emitted — discard the file, re-`cp`,
  and redo the two `Edit`s.
- **Counts match:** number of `.slide` sections == number of `#navlist a`, and
  `data-i` runs `0..n−1` with no gaps. (`grep -c` both.)
- **Donuts close:** each donut's segment lengths sum to ~547.
- **One gradient id:** `id="lg"` appears exactly once (the shared global def); no
  line chart re-declares it or invents a second id. (`grep -c 'id="lg"'` → 1.)
- **Bars in range:** every `--w` is ≤ 100%; every bullet `pos%` is within 0–100.
- **Sources & flags carried:** every `Source:` and `[needs-verification]` from the
  Markdown appears on the right slide.
- **It runs:** open the file in a browser if you can; otherwise confirm the
  structure with a quick `grep`/script check.
