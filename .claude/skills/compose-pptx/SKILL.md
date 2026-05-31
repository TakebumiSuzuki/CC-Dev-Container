---
name: compose-pptx
description: "Consume slide-deck YAML (from narrative-to-slide-outline) and a mandatory sample-slide template .pptx, then build a .pptx by matching each slide to the best-fitting template sample and filling it with native charts/tables/text. Manual-only: never auto-triggers — start it by running /compose-pptx."
disable-model-invocation: true
---

# Compose PPTX

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

The approach is **template-driven and template-mandatory**: the user always supplies a
template `.pptx` that is a **deck of styled sample slides** (a title sample, a bullet-list
sample, a section divider, a chart sample, a table sample, a 2-column sample, an image
sample, a closing sample, …). For each YAML slide we pick the best-matching sample,
duplicate it, and replace its contents. There is **no from-scratch / no-template path** —
if no template is supplied, ask for one.

Charts and tables are rendered as **native PowerPoint objects** (not PNG images), so they
inherit the template's theme and stay editable. See [Charts and tables](#charts-and-tables).

**Out of scope**: post-generation visual QA (rendering each finished slide and inspecting
its layout). That is a separate skill. This skill uses vision only to *understand and match
the template* (Step 2), not to verify its own output.

## Inputs

1. **Slide-deck YAML** — required. Path to the `slide-outline.yaml` produced by
   `narrative-to-slide-outline`. Its full schema is defined in
   `../narrative-to-slide-outline/references/slide_yaml_schema.md` (read in Step 1).
   The YAML's embedded `data:` blocks (`categories`, `series`, `rows`, `bins`,
   `frequencies`, …) are **authoritative** — this skill renders charts/tables straight from
   them and does **not** re-open the original source CSV/Excel/PDF files. Only
   `type: image` entries are read from disk (via their `path:`).
2. **Template `.pptx`** — required, sample-slide deck (see [Purpose](#purpose)).

If either is missing, ask the user. Do not invent a template.

## Output

A `.pptx` file. **Default location: same directory as the input YAML**, fixed basename
`deck.pptx` (e.g. YAML at `./Output/2026-05-29-h1-sales-review/slide-outline.yaml` →
`./Output/2026-05-29-h1-sales-review/deck.pptx`). This keeps the whole pipeline's artifacts
(narrative.md, slide-outline.yaml, deck.pptx) in one folder. The user may override the path.

## Environment and tools

Pick a Python interpreter where `pptx`, `yaml` (PyYAML), `pandas`, `openpyxl`, and `PIL` all
import. In this container that is **`/opt/uv-venv/bin/python`** (it carries `python-pptx`,
pulled in via `markitdown[pptx]`). Check it first, then a project `./.venv/bin/python`, then
`python3`. Confirm the imports before relying on them.

> **Dependency note**: `PyYAML` is **not** in the base image — `build_pptx.py` needs it. Add
> `pyyaml` to the venv (`uv pip install --python /opt/uv-venv/bin/python pyyaml`) or, for
> persistence, to `.devcontainer/Dockerfile`'s `uv pip install` list.

| Tool | Use |
| ---- | --- |
| `python-pptx` | Parse the template, duplicate/fill slides, build native charts & tables |
| `soffice` (LibreOffice) + `pdftoppm` (poppler) | Render template sample slides → image grid for vision matching (Step 2) |
| `PIL` | Thumbnail composition; image handling for `type: image` entries |

`matplotlib`/`seaborn` are **not** installed and are not needed — charts are native (see
below). Do not add a PNG-chart dependency.

**Scripts**: the heavy lifting lives in `scripts/`. This skill drives them by their CLI; it
does not inline their logic.

- `scripts/render_template_thumbnails.py <template.pptx> [out_prefix] [--cols N]` → renders
  the template's slides to a labelled thumbnail-grid JPG (`<out_prefix>.jpg`, split into
  `-1/-2` for large decks) via `soffice --headless --convert-to pdf` then `pdftoppm`. Each
  thumbnail is labelled `idx: N` (0-based presentation order) so its label matches
  `inspect_template.py` and mapping.json. Used in Step 2 (vision path). Adapted from
  `anthropics/skills:skills/pptx/scripts/thumbnail.py`; depends on the vendored
  `scripts/office/soffice.py` (LD_PRELOAD helper for sandboxed LibreOffice).
- `scripts/inspect_template.py <template.pptx> [--pretty]` → prints a JSON inventory: one
  object per slide with `index`, `layout_name`, `title`, `has_chart`/`has_table`/
  `has_picture`, `n_text_placeholders`, `texts`, and a heuristic `suggested_role`. Step 2
  **fallback** when `soffice`/`poppler` are unavailable.
- `scripts/build_pptx.py --yaml <yaml> --template <template.pptx> --mapping <mapping.json> [--out <deck.pptx>]`
  → builds the deck (Step 4). Contract detailed in [Step 4](#step-4-build-the-deck). Uses the
  python-pptx object model. Slide duplication (no native python-pptx API) is done by creating
  a slide from the sample's layout, deep-copying the sample's shape tree into it, and
  re-relating images/media (chart parts are intentionally not re-related — charts are rebuilt
  fresh; see Step 4).

## Workflow

### Step 1: Resolve inputs and read references

Issue together in one parallel batch:

- **Read the YAML** (the required input).
- **Read `../narrative-to-slide-outline/references/slide_yaml_schema.md`** — the schema you
  parse against (slide fields, the five `data` types, the number-vs-string cell rule).
- Confirm the **template path** (ask if not given) and pick the **Python interpreter**.

### Step 2: Build a template inventory

Understand what sample slides the template offers, so Step 3 can match against them.

**Primary (vision):** run `scripts/render_template_thumbnails.py`, then Read the resulting
PNGs (the Read tool ingests them visually). For each template slide record:

- its index,
- its **role / layout** (title, agenda/bullets, section divider, chart, table, 2-column,
  image, closing, …),
- the **sample objects** it already contains — a native chart? a table? a picture? how many
  text placeholders? — because filling reuses those objects,
- its overall visual character (so a chart-heavy YAML slide lands on a chart sample, etc.).

**Fallback (no `soffice`/`poppler`):** run `scripts/inspect_template.py` and build the same
inventory from the parsed shape data instead of from images. In this container vision is
available, so this branch is for portability only.

### Step 3: Map YAML slides → template sample slides

For each YAML slide, choose the best-fitting template sample using, in priority order:

1. **`suggested_layout`** — the primary hint from the YAML (e.g. *"Table placed large in the
   center"*, *"2-column: wins on the left, challenges on the right"*, *"Section Divider"*).
2. **Body shape** — `body: ""` → a section-divider sample; numbered/bulleted body → a
   bullet sample; title-slide-style subtitle lines → the title sample.
3. **`data` type** — a slide whose `data` is a `bar_chart`/`line_chart`/`pie_chart`/`histogram` needs a
   sample that contains a chart; a `table` needs a table sample; an `image` needs a picture
   sample.

**Closest match, never block.** If nothing fits perfectly, pick the nearest sample and move
on (per the confirmed design). Do not stop to ask.

Write the decisions to **`mapping.json`** next to the YAML — a list of
`{yaml_index, template_index, notes}`. This is the human-inspectable contract handed to the
builder. Note in `notes` any slide that fell back to a non-ideal sample.

### Step 4: Build the deck

Run `scripts/build_pptx.py` with the YAML, template, mapping, and output path.

The builder's contract (what it does, so the mapping you produce is correct):

- **Start from a copy of the template** so the new deck inherits its master, theme, fonts,
  and color scheme.
- For each YAML slide in order, **duplicate the mapped template sample slide** (python-pptx
  has no native "duplicate slide", so the builder deep-copies the slide XML and appends it —
  this is the known workaround), then fill it:
  - **Title** → the slide's title text.
  - **Body** → render light Markdown (bold `**…**`, `-` bullets, numbered lists) into the
    body text frame; **strip `{{placeholder}}` tokens** (they only marked where data goes —
    the sample already positions the object).
  - **`data` entries** (matched by order/type to the sample's objects):
    - `bar_chart` / `line_chart` / `pie_chart` / `histogram` → the builder **records the sample chart's
      position, removes it, and adds a fresh native chart** (`add_chart`) there with the YAML
      data. It deliberately does **not** `replace_data()` the copied chart: duplicating a
      slide makes the copy share the *same* chart part as the original, so `replace_data()`
      would corrupt sibling slides mapped to the same sample. A fresh chart is independent and
      inherits the deck's theme colors. (Cost: a sample chart's bespoke styling is not kept.)
      `bar_chart` → clustered columns, `line_chart` → line, `pie_chart` → pie (one series of
      `categories`/`values` as parts of a whole, legend on), `histogram` → columns with `bins`
      as categories and one series of `frequencies`.
    - `table` → if the sample has a table, rewrite its cells, **growing/shrinking both rows
      and columns** to fit (column widths are redistributed so a grown table still fits the
      slide); otherwise `add_table`. Apply the schema's number-vs-string rule — string cells
      render verbatim, numbers may be formatted.
    - `image` → load the file at `path:`, replace the sample picture in place (reusing its
      position/size); set alt text from `caption`.
  - **`speaker_notes`** → the slide's notes text frame.
- After all target slides are built, **delete the leftover original sample slides**, then
  save to the output path.

Chart/table data is read **only** from the YAML (authoritative); the builder never reopens
source CSV/Excel/PDF. The single on-disk read is `image.path`.

### Step 5: Report

Tell the user:

- Output path and slide count.
- The per-slide template mapping (YAML slide → template sample used).
- Any slide that fell back to a **non-ideal** sample (from `mapping.json` notes), so the
  user can adjust the template or the YAML.
- Any **missing image files** (`type: image` paths that didn't exist).

Do **not** render or visually inspect the finished slides — that QA pass is a separate skill.

## Re-running and edits

The deck is regenerated from the YAML, so to change content **edit the YAML and re-run**,
rather than hand-editing the `.pptx`:

- Content/structure changes (add/split/reorder slides, fix a number, swap a chart's data) →
  edit the YAML via `narrative-to-slide-outline` (its Step 8 editing loop), then re-run this
  skill.
- A different look → swap the template `.pptx` and re-run.

This keeps the YAML the single source of truth and the `.pptx` a disposable build artifact.

## Charts and tables

Both are **native PowerPoint objects**, by design:

- **Native, not PNG** — they inherit the chosen template's theme (palette, fonts, legend
  styling) and stay editable by whoever receives the deck. The YAML's chart types
  (`bar_chart` / `line_chart` / `pie_chart` / `histogram`) all map directly to native python-pptx chart
  types, so there is nothing PNG rendering would add. `matplotlib`/`seaborn` are
  intentionally not used (and not installed).
- **Tables reuse the sample object** — cell-rewrite (with row/column grow-shrink) preserves
  the template author's table styling and only changes the data.
- **Charts are rebuilt fresh** at the sample chart's position via `add_chart`, *not*
  `replace_data()` on the copied chart. Because slide duplication makes the copy share the
  original's chart part, `replace_data()` would corrupt other slides mapped to the same
  sample; a fresh per-slide chart avoids that and still inherits the deck's theme colors. The
  trade-off — a sample chart's bespoke styling is not carried over — is accepted in v1.

## Important principles

- **Template is mandatory.** No from-scratch generation. Missing template → ask.
- **YAML is authoritative for data.** Render charts/tables from the YAML's embedded values;
  never reopen source data files (images excepted).
- **Native charts/tables** — tables reuse the sample's object; charts are rebuilt fresh (see
  [Charts and tables](#charts-and-tables)). Both inherit the deck theme.
- **Closest-match mapping, never block.** Record non-ideal matches; don't stop to ask.
- **Scripts do the work, the skill orchestrates.** `render_template_thumbnails.py`,
  `inspect_template.py`, and `build_pptx.py` (plus the vendored `office/soffice.py`) live
  under `scripts/`; this skill drives them by CLI rather than re-deriving their logic.
