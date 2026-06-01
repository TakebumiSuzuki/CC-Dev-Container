---
name: narrative-to-html-deck
description: >-
  Convert a structured Markdown report (## sections, ### subsections, tables,
  key takeaways, anticipated Q&A) into a single-page, browser-based "scroll-deck"
  presentation: a sticky tab bar (one tab per ## section plus a Cover), sticky
  section/subsection headings, slide-like vertical spacing, Chart.js charts built
  from the markdown tables, KPI hero cards, callouts, item cards, and a Q&A
  accordion. Output is a self-contained index.html + css + js folder.
disable-model-invocation: true
---

# narrative-to-html-deck: Markdown report → browser scroll-deck

## What this produces

A self-contained folder that opens with a double-click (no build, no server):

```
<output>/
├── index.html
├── css/styles.css      ← copied verbatim from the template
└── js/
    ├── charts.js        ← scaffold + your charts built from the md tables
    └── main.js          ← copied verbatim from the template
```

The page is a **scroll-deck**: a sticky tab bar switches between `##` sections;
within a section the reader scrolls through "slides" (subsections) separated by
generous whitespace, with the section heading and subsection heading pinned at
the top so the audience always knows where they are. It is meant for live
screen-sharing and non-linear Q&A (jump to any tab), not for print.

## When to reach for it

The source is a **structured narrative report** — prose organized under `##`
headings, often with markdown tables, a "Key Takeaways" list, and an
"Anticipated Q&A" section. If the user instead has loose notes, a spreadsheet,
or wants actual editable slides (PPTX), this skill is not the right fit.

## Build procedure

1. **Read the whole markdown first.** Map its structure before writing anything:
   the title block, every `##` section, which sections have `###` subsections,
   every table, and any "Key Takeaways" / "Anticipated Q&A" sections.

2. **Create the output folder and copy the two verbatim assets.** `css/styles.css`
   and `js/main.js` from `assets/template/` are completely content-agnostic —
   copy them unchanged. Do **not** rewrite them per report.

3. **Write `index.html`** from `assets/template/index.html`, following the
   mapping rules below. The skeleton already demonstrates every component.

4. **Write `js/charts.js`** from `assets/template/js/charts.js`: keep the
   defaults / palette / `make()` / `resizeChartsIn()` and replace the example
   charts with ones built from the report's tables.

5. **Verify** (see "Before you finish").

## The mapping rules (markdown → structure)

These rules are what make the result coherent. The guiding principle: **the
HTML structure should mirror the markdown's heading structure** — don't invent
divisions the source doesn't have, and don't merge things the source separates.

### Cover tab
Build a leading **Cover** tab from the report's title block (title, org/author,
audience, duration, date). It's a full-height hero (`.cover`). It is the first
tab and starts selected.

### Tabs = `##` sections
One tab per `##` section, in order, after Cover. Each tab's `data-target` must
equal its `<section class="panel" id="...">` id. A `## section` becomes a
`<section class="panel">` containing `<div class="wrap">` and a sticky
`<h2 class="panel-title">`.

### Slots = `###` subsections — and the divider rule
Inside a section, each `###` subsection becomes one **`.slot`** (which carries a
bottom divider line). **This is the most important rule:**

> Draw a horizontal divider only where a heading appears. A `##` section that has
> **no** `###` subheadings becomes a **single slot with no internal dividers** —
> keep all its prose together. Never split a continuous run of paragraphs into
> separate slots just to fill space.

Every slot's content is wrapped in `<div class="slot-body">`. Keep that wrapper —
the sticky subheading "swaps" cleanly at the next heading because its sticky
range is bounded to `.slot-body`. A subsection heading is `<h3>` placed as the
**direct** first child of `.slot-body` (so it becomes sticky); headings *inside*
a callout or card are not direct children and stay non-sticky, which is correct.

When a section heading is followed directly by body text with no `###`, the CSS
adds the right spacing automatically — you don't need to do anything.

### KPI hero cards (for the executive summary)
If a section is an executive summary with headline numbers, lead with a
`.kpi-grid` of `.kpi` cards (one per headline metric). Color the top accent and
the delta semantically: `kpi--good`/`delta-up` for improvement,
`kpi--bad`/`delta-down` for decline, `kpi--neutral`/`delta-flat` for neutral.
This gives executives the whole picture in one glance.

### Charts from tables
Turn data tables into Chart.js charts (in `charts.js`), and keep the original
table available inside a `<details class="data-table">` ("View data table") so
the numbers are one click away during Q&A. Pick the chart shape from the data:

| Table shape | Chart |
| --- | --- |
| Value(s) over time, optionally with a rate/ratio | combo bars + line on a 2nd axis |
| Two series compared across categories (prior vs current) | grouped bars |
| One value ranked across categories | horizontal bars (`indexAxis: "y"`) |
| Parts of a whole (status mix, reasons) | doughnut |
| Composition across a few groups | stacked bars |
| Two metrics + a third by importance | bubble (x, y, r) |

Color **semantically** (improvement green, decline/risk red, caution amber) so
the story reads at a glance — this is the whole point of charting over tables.
Label axes with the real unit (`%`, `$M`, count). Multi-line category labels
must be **arrays** (`["Tech &", "Digital"]`), not `"\n"` strings.

### Other components
- **Callouts** (`.callout--tension` / `.callout--warn`): spotlight the key
  tension or a risk/escalation. A callout is emphasis, not a section divider.
- **Cards** (`.card--win` / `.card--issue`): a list of named items (notable
  wins, delivery issues, practice profiles). `.card-tag` is for low-importance
  secondary info (IDs, tags) and is intentionally small.
- **Priorities**: numbered recommendations as `.priority` rows with a
  `.priority-num` badge.
- **Key Takeaways**: a `<ul class="takeaways">`.
- **Anticipated Q&A**: a `<details class="qa">` accordion — question in
  `<summary>`, answer in `<p>`. This doubles as the presenter's crib sheet.

### Language
Match the source language of the report (the example was English). Translate
nothing unless asked.

## Hard invariants (these break silently if wrong)

- **Tab ↔ panel parity:** every tab `data-target` has a matching panel `id`, and
  vice versa. Cover is first and `aria-selected="true"`; all other panels start
  `aria-hidden="true"`.
- **Canvas ↔ chart parity:** every `<canvas id="x">` has a `make("x", …)` in
  `charts.js`, and every `make(...)` targets a real canvas.
- **Keep `resizeChartsIn()`** in charts.js and don't touch the chart-refresh
  call in main.js. Charts in a hidden (`display:none`) panel lay out at 0px;
  main.js resizes them when their tab is first shown. Without this, charts in
  non-default tabs render blank.
- **Pin library versions you verified, not remembered.** Confirm the current
  Chart.js CDN URL/version (jsDelivr / chartjs.org) and the Inter Google Fonts
  link from a primary source before embedding them. Do not trust memory for
  version numbers or file paths.

## Tunable knobs (all in `:root` of styles.css)

The reader/presenter will often want to dial the feel. These are the levers —
change the variable, not scattered values:

- `--slot-min` (default `50vh`) — minimum height of each slide-like slot.
- `--nav-h` / `--title-h` — sticky tab-bar height and big-heading height; the
  subsection heading pins at `--nav-h + --title-h`. If the two sticky headings
  overlap or gap at some width, adjust `--title-h`.
- `--pad-box` — inner padding shared by all surface boxes (KPI/card/callout/…).
- `--fs-base / --fs-data / --fs-ui / --fs-label` — the type scale. Body content
  uses `--fs-base`; keep real content at body size (don't shrink card or Q&A
  prose below it).
- `.slot { padding-bottom }` — the gap from a subsection's end to the next
  divider.

## Before you finish

- Cross-check the two parities above (tab/panel, canvas/chart) and that the
  HTML `<div>` tags balance.
- `node --check js/charts.js` and `node --check js/main.js`.
- If a browser is available, open `index.html` and click through every tab:
  confirm charts render on each tab (not just the first), the sticky headings
  pin correctly, and the divider/spacing rhythm looks right. If no browser is
  available, say so — don't claim it was visually verified.
