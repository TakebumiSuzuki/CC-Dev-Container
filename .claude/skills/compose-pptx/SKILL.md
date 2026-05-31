---
name: compose-pptx
description: "Consume slide-deck YAML (from narrative-to-slide-outline) and a mandatory sample-slide template .pptx, then build a .pptx by matching each slide to the best-fitting template sample and filling it. Builds via raw OOXML editing (unpack → edit XML → pack, the Anthropic pptx method) — NO python-pptx in the build — and includes a clone-to-grid solver for layouts the template has no sample for. Manual-only: never auto-triggers — start it by running /compose-pptx."
disable-model-invocation: true
---

# Compose PPTX (raw-XML build)

## Purpose

Final stage of the three-stage pipeline. Consume the slide-deck YAML and produce a `.pptx`.

```
[Raw data / docs / user intent]
        ↓ compose-slide-narrative
[Narrative Markdown]
        ↓ narrative-to-slide-outline
[Slide-deck YAML]
        ↓ (THIS SKILL: compose-pptx)
[.pptx file]
```

The .pptx is built by **editing the raw OOXML** — unpack the template ZIP, edit
the slide XML directly (with the Edit tool + small plumbing scripts), then repack.
This is the method from `anthropics/skills:skills/pptx`. **No python-pptx is used
in the build.** (The only python-pptx use anywhere is the read-only
`inspect_template.py`, a Step-2 *inventory* fallback — never the build.)

It includes a **clone-to-grid solver** (`clone_grid.py`) for the case where a YAML
slide needs a layout the template has no sample for (e.g. a 2×4 card grid when the
template only ships a 3-card row). See [The grid solver](#the-grid-solver-clone_gridpy).

The approach stays **template-driven and template-mandatory**: the user supplies a
template `.pptx` that is a **deck of styled sample slides** (a title sample, a
bullet-list sample, a section divider, a chart sample, a table sample, a 2-column
sample, an image sample, a closing sample, …). For each YAML slide we pick the
best-matching sample, **duplicate it, and replace its contents in XML**. There is
**no from-scratch / no-template path** — if no template is supplied, ask for one.

Charts and tables are kept as **native PowerPoint objects** (not PNG), so they
stay editable and on-theme.

**Out of scope**: post-generation visual QA (rendering each finished slide and
inspecting its layout, overflow, contrast). That is a separate skill, to be added
later. This skill uses vision only to *understand and match the template*
(Step 2), never to verify its own output.

## Inputs

1. **Slide-deck YAML** — required. Path to the `slide-outline.yaml` produced by
   `narrative-to-slide-outline`. Its full schema is
   `../narrative-to-slide-outline/references/slide_yaml_schema.md` (read in Step 1).
   The YAML's embedded `data:` blocks (`categories`, `series`, `rows`, `bins`,
   `frequencies`, …) are **authoritative** — this skill renders charts/tables
   straight from them and does **not** re-open the source CSV/Excel/PDF. Only
   `type: image` entries are read from disk (via their `path:`).
2. **Template `.pptx`** — required, sample-slide deck (see [Purpose](#purpose)).

If either is missing, ask the user. Do not invent a template.

## Output

A `.pptx` file. **Default location: same directory as the input YAML**, fixed
basename `deck.pptx` (e.g. YAML at `./Output/2026-05-29-h1-sales-review/slide-outline.yaml`
→ `./Output/2026-05-29-h1-sales-review/deck.pptx`). The user may override the path.

## Environment and tools

Pick a Python interpreter where `defusedxml`, `openpyxl`, `yaml` (PyYAML) and `PIL`
all import. In this container that is **`/opt/uv-venv/bin/python`**. Check it first,
then a project `./.venv/bin/python`, then `python3`. Confirm the imports first.

> **Dependency note**: the build needs **`defusedxml`**, **`openpyxl`** and
> **`pyyaml`**. If any is missing from the venv, add it
> (`uv pip install --python /opt/uv-venv/bin/python defusedxml openpyxl pyyaml`)
> or, for persistence, to `.devcontainer/Dockerfile`'s `uv pip install` list.

| Tool | Use |
| ---- | --- |
| `defusedxml` / the Edit tool | Unpack/pack and edit the raw slide XML (the build) |
| `openpyxl` | Regenerate a chart's embedded workbook so "Edit Data" matches |
| `soffice` (LibreOffice) + `pdftoppm` (poppler) | Render template samples → image grid for vision matching (Step 2) |
| `PIL` | Thumbnail composition; `type: image` handling |

**Scripts** (the skill drives them by CLI; it does not inline their logic). Run
them with the chosen interpreter, from the skill's `scripts/` directory so the
`office` package imports:

| Script | Role | Stage |
| ------ | ---- | ----- |
| `office/unpack.py <pptx> <dir>` | Extract + pretty-print + escape smart quotes | 4 |
| `office/pack.py <dir> <pptx>` | Condense + zip back to .pptx | 4 |
| `slide_order.py <dir> [--index N]` | Resolve 0-based presentation order → `slideN.xml` | 4 |
| `add_slide.py <dir> <slideN.xml>` | Duplicate a sample slide (handles rels/Content_Types/rId) | 4 |
| `clone_grid.py …` | Replicate a styled shape into an R×C grid | 4 |
| `set_chart_data.py …` | Fork the slide's chart part + write YAML data into it | 4 |
| `add_chart.py …` | Author a native chart **from scratch**; swaps a wrong-type sample chart in place, else places fresh | 4 |
| `fill_table.py …` | Reshape + fill a template table | 4 |
| `fill_text.py …` | Fill title/insight/caption + bullet bodies from a JSON spec (**optional** bulk helper; falls back to the Edit tool for rich formatting) | 4 |
| `set_image.py …` | Replace a sample picture with a file | 4 |
| `set_notes.py …` | Attach speaker notes (clones a template notesSlide) | 4 |
| `clean.py <dir>` | Remove orphaned slides/media/rels/Content-Types | 4 |
| `render_template_thumbnails.py <pptx>` | Labelled thumbnail grid for vision matching | 2 |
| `inspect_template.py <pptx>` | JSON inventory (read-only, python-pptx) — Step-2 fallback | 2 |

`add_slide.py`, `clean.py`, `office/unpack.py`, `office/pack.py` are adapted from
`anthropics/skills:skills/pptx`.

## Workflow

### Step 1: Resolve inputs and read references

Issue together in one parallel batch:

- **Read the YAML** (the required input).
- **Read `../narrative-to-slide-outline/references/slide_yaml_schema.md`** — the
  schema you parse against (slide fields, the five `data` types, the
  number-vs-string cell rule).
- Confirm the **template path** (ask if not given) and pick the **interpreter**.

### Step 2: Build a template inventory

Understand what sample slides the template offers.

**Primary (vision):** run `render_template_thumbnails.py`, then Read the resulting
PNG/JPG. For each template slide record: its **index** (0-based presentation
order), its **role/layout** (title, bullets, divider, chart, table, 2-column,
image, closing, …), the **sample objects** it contains (native chart? table?
picture? how many text placeholders?), and its visual character.

**Fallback (no `soffice`/`poppler`):** run `inspect_template.py` and build the same
inventory from the parsed shape data. In this container vision is available, so
this branch is for portability only.

### Step 3: Map YAML slides → template sample slides

For each YAML slide, choose the best-fitting sample, in priority order:

1. **`suggested_layout`** — the primary hint from the YAML.
2. **Body shape** — `body: ""` → a section-divider sample; numbered/bulleted body
   → a bullet sample; title-slide-style subtitle → the title sample.
3. **`data` type** — `bar_chart`/`line_chart`/`pie_chart`/`histogram` → **prefer a
   sample that contains a chart of that exact plot type** (`set_chart_data.py` reuses
   the sample's plot type — route a line chart to a line sample, a bar chart to a bar
   sample); a `table` → a table sample; an `image` → a picture sample.
   - **No sample of the needed plot type, but the template has *some* chart** → map
     the slide to the **closest chart sample anyway** and note `add_chart (swap type)`
     in `notes`. Step 4 copies that sample and has `add_chart.py` replace its chart
     in place, so the new plot type keeps the template's chosen position and size.
   - **No chart sample at all** → map to any plain sample and note `add_chart` in
     `notes`; Step 4 builds the chart from scratch into a default/`--area-in` box.

**Closest match, never block.** If nothing fits, pick the nearest sample and move
on. If the content needs a layout no sample provides (e.g. a 2×4 grid), pick the
closest sample that has **one** styled cell to replicate and flag it for the grid
solver in Step 4.

Write decisions to **`mapping.json`** next to the YAML — a list of
`{yaml_index, template_index, notes}`. Note any fallback in `notes`.

### Step 4: Build the deck (raw XML)

Work in a scratch directory.

1. **Unpack** the template:
   `python office/unpack.py <template.pptx> <work>/unpacked`

2. **Resolve order → files:** `python slide_order.py <work>/unpacked` gives the
   `index → slideN.xml` map. Translate every `mapping.json` `template_index` into a
   concrete sample slide file.

3. **Duplicate samples, in YAML order.** For each YAML slide, run
   `python add_slide.py <work>/unpacked <sampleSlideN.xml>`. It creates a new
   `slideK.xml` (copying rels/Content_Types/rIDs correctly) and **prints the
   `<p:sldId …/>` line** to add. Collect these lines.

4. **Rebuild `<p:sldIdLst>`** in `ppt/presentation.xml` with the Edit tool: insert
   the new `<p:sldId>` entries **in YAML order**, and **remove the original
   sample-slide `<p:sldId>` entries** (the leftover samples). Do all structural
   changes before editing content.

5. **Fill each new slide** (this is the Anthropic method: edit the slide's XML).
   For each built `slideK.xml`:
   - **Title / body text** → **use the Edit tool** on the slide XML. Replace the
     sample's placeholder text; render light Markdown as separate `<a:p>`
     paragraphs (bold → `<a:rPr b="1">`, `-`/numbered → one `<a:p>` each); **strip
     `{{placeholder}}` tokens** (they only marked where an object goes — the sample
     already positions it). Follow the formatting rules below.
     - **Bulk shortcut**: for the common cases (title, the insight line, the
       caption, and plain/numbered/bold-lead bullet bodies) you may instead drive
       `fill_text.py <dir> slideK.xml --spec <spec.json>`, which sets them from a
       JSON spec while reusing the sample's styling — handy when a deck has many
       text slides. It only covers what its spec expresses; **fall back to the
       Edit tool** for richer formatting (hyperlinks, per-word colour, superscript,
       mixed sizes, multi-level nesting). See `fill_text.py`'s header for the schema.
   - **`data` entries**, by their `type`:
     - `bar_chart`/`line_chart`/`pie_chart`/`histogram` → write the entry to a temp JSON.
       **Route by plot type** (the decisive rule):
       - The mapped sample has a chart of the **same plot type** → reuse it:
         `python set_chart_data.py <work>/unpacked slideK.xml --data-json <entry.json>`.
         It **forks** the chart part first (so two slides built from the same chart
         sample get independent data — see [Charts](#charts)) then writes the data,
         inheriting the sample's exact axis/label/colour styling and placement.
       - The sample's chart is the **wrong plot type** (e.g. only a bar sample but the
         YAML wants a pie), **or there is no chart sample at all** → build from scratch:
         `python add_chart.py <work>/unpacked slideK.xml --data-json <entry.json>`.
         When the copied sample already holds a chart, `add_chart.py` **takes over that
         chart's frame in place** — same position and size — and removes the wrong-type
         chart, so the new chart lands exactly where the template put it. With no chart
         on the slide it uses `--area-in` or a default box. See [Charts](#charts).
     - `table` → `python fill_table.py <work>/unpacked slideK.xml --data-json <entry.json>`.
     - `image` → `python set_image.py <work>/unpacked slideK.xml --path <file> --alt "<caption>"`.
   - **`speaker_notes`** → write to a temp file and run
     `python set_notes.py <work>/unpacked slideK.xml --text-file <notes.txt>`.
   - **Grid layouts** the sample can't express → see
     [The grid solver](#the-grid-solver-clone_gridpy).

   Slides are independent XML files — if subagents are available, fill them in
   parallel (tell each subagent: the slide path, **"use the Edit tool"**, and the
   formatting rules below).

6. **Clean:** `python clean.py <work>/unpacked` (drops the orphaned sample slides
   and now-unreferenced media/charts).

7. **Pack:** `python office/pack.py <work>/unpacked <out>/deck.pptx`.

### Step 5: Report

Tell the user:

- Output path and slide count.
- The per-slide template mapping (YAML slide → sample used).
- Any slide that fell back to a **non-ideal** sample (from `mapping.json` notes) or
  used the **grid solver**, so the user can adjust the template or YAML.
- Any **missing image files** (`type: image` paths that didn't exist).

Do **not** render or visually inspect the finished slides — that QA pass is a
separate skill.

## Re-running and edits

The deck is regenerated from the YAML, so to change content **edit the YAML and
re-run** rather than hand-editing the `.pptx`:

- Content/structure changes → edit the YAML via `narrative-to-slide-outline`, then
  re-run this skill.
- A different look → swap the template `.pptx` and re-run.

The YAML is the single source of truth; the `.pptx` is a disposable build artifact.

## Charts

Native, editable, and **forked per slide**. The hazard: `add_slide.py` duplicates a
slide by copying its XML **and its rels**, so a duplicated chart slide still points
at the *original* chart part. Two slides built from the same chart sample would
**share one chart part** — writing data into one corrupts the other.

`set_chart_data.py` resolves it: it **forks** the chart part
(`chart{N}.xml` + its embedded `.xlsx` get fresh copies, the slide is repointed,
`[Content_Types].xml` updated), then rewrites the forked chart's cached
categories/series and **regenerates the embedded workbook with openpyxl** so PowerPoint's
"Edit Data" stays consistent. It **reuses the sample chart's axes, colours and
styling** — only the data changes. It reuses the sample's plot type, so route each
YAML chart type to a matching sample in Step 3.

**From-scratch fallback (`add_chart.py`) — for wrong plot type *or* no chart at all.**
`set_chart_data.py` can only reuse the sample's plot type, so it covers the case where a
sample of the **right** type exists. The two cases it can't are exactly what `add_chart.py`
handles:

- **Wrong plot type** (the template has, say, a bar sample but the YAML wants a pie).
  Map the slide to the closest chart sample and copy it; `add_chart.py` then **takes over
  the copied chart's `<p:graphicFrame>` in place** — reading its `<a:off>`/`<a:ext>`,
  removing the old (wrong-type) chart, and dropping the new one at the **same position and
  size**. The old chart part is orphaned and `clean.py` removes it. This is the important
  one: you get the needed plot type *without* losing the template's chosen placement.
- **No chart sample at all** — nothing to copy; the chart is placed at `--area-in` or a
  default content box below a title.

In both cases it builds a complete chart part from scratch (the `c:chartSpace` XML + an
openpyxl-generated embedded `.xlsx` + its rels + `[Content_Types].xml` entries). It stays
**on-theme without hard-coding colours**: series use `<a:schemeClr val="accentN"/>`
references, so the chart picks up the deck's accent palette automatically (and follows a
theme swap) — `theme1.xml` is never parsed. Supports `bar_chart`, `line_chart`,
`pie_chart` and `histogram` (a pie is axis-less and slice-coloured via `varyColors`).
**Prefer `set_chart_data.py` when a same-type sample exists** — it inherits the template's
exact axis/label styling, which the from-scratch path only approximates.

## Tables

`fill_table.py` reuses the sample table object: it grows/shrinks rows and columns by
deep-copying the last `<a:tr>`/`<a:gridCol>`/`<a:tc>` (so new cells inherit the
sample's fills, borders, fonts), redistributes the original total width so a grown
table still fits, and rewrites each cell's text **in place**, preserving the first
run's `<a:rPr>` so the template's cell font/size/colour survives. Apply the schema's
number-vs-string rule — string cells render verbatim, numbers may be formatted.

## Images

`set_image.py` replaces a sample `<p:pic>`'s image with a file from disk, reusing the
sample's position/size/crop: it copies the new image into `ppt/media`, adds a
`[Content_Types].xml` Default for its extension if missing, adds a fresh image
relationship, repoints the `<a:blip>` `r:embed`, and sets the alt text (`descr`)
from `caption`.

## The grid solver (`clone_grid.py`)

For the "novel layout" case where a YAML slide needs a grid the template ships no
sample for.

**Do not hand-author bare shapes and compute EMU by hand.** Instead:

1. Map the slide to the closest sample that contains **one** already-styled cell
   (a card / icon-box / stat tile) — note its shape's `cNvPr id` from the slide XML.
2. After duplicating that sample, run:
   ```
   python clone_grid.py <work>/unpacked slideK.xml \
       --shape-id <id> --rows R --cols C \
       [--area-in "x,y,w,h"] [--margin-in 0.5] [--gap-in 0.25] [--no-resize]
   ```
   It removes the source shape and lays **R×C deep-copies** of it across a computed
   grid, each placed (and by default resized) into its cell with a unique shape id
   and a name `gridcell_r{r}c{c}`. Every cell inherits the template's real visual
   language (fill, outline, font, effects) — **only the geometry is solved here**.
3. Fill each cell's text with the Edit tool (find each by its `gridcell_rNcM` name).

`clone_grid.py` does **not** fit text — a cell narrower than the source may overflow.
That, like all visual checking, is the separate QA stage's job.

## Important principles

- **Template is mandatory.** No from-scratch generation. Missing template → ask.
- **Raw-XML build, no python-pptx.** Unpack → edit slide XML (Edit tool + the
  plumbing scripts) → pack. python-pptx appears only in the read-only Step-2
  inventory fallback, never in the build.
- **YAML is authoritative for data.** Render charts/tables from the YAML's embedded
  values; never reopen source data files (images excepted).
- **Native charts/tables, forked/reused for independence.** Charts are forked per
  slide; tables reuse the sample object. Both inherit the deck theme.
- **Closest-match mapping, never block.** Record non-ideal matches; for missing
  grid layouts, use `clone_grid.py` rather than blocking.
- **Structural changes before content.** Finish `sldIdLst` edits (add new, remove
  samples) before filling slide text.
- **Scripts do the plumbing, the skill + Edit tool do the content.** Drive the
  scripts by CLI; edit slide text directly in XML.
- **No QA here.** Rendering and visual inspection are a separate, later skill.

## Formatting rules (when editing slide XML)

- **Bold headers, subheadings and inline labels**: `b="1"` on `<a:rPr>`.
- **No unicode bullets (•)**: let bullets inherit from the layout; only specify
  `<a:buChar>`/`<a:buNone>` to override.
- **Multi-item content** → one `<a:p>` per item; never concatenate into one string.
  Copy the sample paragraph's `<a:pPr>` to preserve spacing.
- **Smart quotes**: unpack escapes them to entities (`&#x201C;` …) and pack leaves
  them; when you add quoted text by hand, type the entity, since the Edit tool
  normalizes curly quotes to ASCII.
- **Remove, don't blank, excess sample elements**: if the sample has 4 cells and
  the content has 3, delete the 4th element entirely (not just its text).
