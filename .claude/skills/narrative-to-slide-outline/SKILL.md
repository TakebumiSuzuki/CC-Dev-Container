---
name: narrative-to-slide-outline
description: Convert a Markdown narrative/strategy document into slide-deck YAML for a downstream pptx pipeline (narrative → YAML → pptx). Manual-only: invoke explicitly with /narrative-to-slide-outline.
disable-model-invocation: true
---

# Narrative to Slide Outline

## Purpose

Convert a Markdown narrative document (flowing prose containing analysis, recommendations, and embedded data references) into a structured YAML intermediate file consumed by a downstream pptx-generation skill.

This skill is the middle stage of a three-stage pipeline:

```
[Raw data]
        ↓ (CSVs, Excel files, PDFs, PPTX)
[Upstream AI: writes a narrative strategy document]
        ↓ (Markdown)
[THIS SKILL: produces slide-deck YAML]
        ↓ (YAML)
[Downstream pptx skill: produces .pptx file]
```

Keep your scope narrow: read prose, produce YAML. Do not generate pptx. During the generation flow, do not open the referenced data files (CSV/Excel) — for producing the YAML, the narrative's inline tables are authoritative. (Those files *are* read later, but only by the QA subagent in Step 6, and only to verify that the inline tables were transcribed correctly from their source.)

## Out of scope

This skill is **manual-only**: it runs only when the user invokes it explicitly (see `disable-model-invocation` in the frontmatter), so it never auto-triggers on prose. Once running, step back and redirect if the request is actually one of these:
- Generating the final pptx file — that's a different skill
- A trivial text-only tweak to an existing YAML (rename a title, fix a typo, reword `speaker_notes`) — just do it with Edit; you don't need this skill's machinery

Editing an existing deck in more substantial ways (changing chart/table data, adding or removing slides, re-syncing after the narrative changed) **is** in scope — see [Editing an existing deck](#editing-an-existing-deck).

## Input

A Markdown document with these characteristics:
- A title (H1 or top-of-document text)
- Optional metadata lines (author, date, audience, duration)
- Section headings (`##`, `###`) that suggest natural slide breaks
- Prose paragraphs with analysis embedded
- **Inline Markdown tables** for any data that should appear as a chart or table on a slide. These tables are the primary source of structured numbers for the YAML
- **Data source breadcrumbs** in parenthetical form, indicating where the data came from upstream:
  - CSV: `(Source: ./data/foo.csv)`
  - Excel with sheet name: `(Source: ./data/foo.xlsx, sheet: SheetName)`
  - PDF with page number: `(Source: ./reports/q3.pdf, page: 7)` — the `page:` locator is **required** (it tells QA where to look)
  - PowerPoint with slide number: `(Source: ./decks/board.pptx, slide: 3)` — the `slide:` locator is **required**
  - The same `(Source: ...)` syntax may also be attached **inline to a prose sentence** to cite a claim that renders no table or chart of its own (e.g., `...growing ~2x faster than competitors (Source: ./data/market_share.csv).`). Capture these as slide-level `sources` (see schema)
- **Image references**: parenthetical `(Image: ./images/team.jpg)`, or Markdown image syntax `![caption](./images/team.jpg)`

Input may be supplied as:
- A file path (e.g., `./narrative.md`)
- Pasted text in the chat

If neither is provided, ask the user.

## Output

A YAML file. Default location: same directory as the input file, with the same basename and a `.yaml` extension (e.g., `q3_review.md` → `q3_review.yaml`). If the input was pasted text with no source file, ask the user for the desired output path before writing.

### Output schema

```yaml
---
title: "Presentation title"
author: "Author name"
date: "YYYY-MM-DD"

slides:
  - title: "Slide title"
    body: |
      Body text. Markdown is allowed.

      Reference embedded data with {{placeholder_name}} where charts, tables,
      or images should appear in the slide.
    suggested_layout: "Free-form layout hint, e.g., '2-column: issues on the left, actions on the right'"
    data:
      placeholder_name:
        type: bar_chart | line_chart | histogram | table | image
        # ... type-specific fields, see below
    speaker_notes: |
      Speaker notes.
    sources:
      - claim: "the prose claim being cited"
        source: "./data/foo.csv"
```

Field reference:

| Field | Required | Purpose |
|---|---|---|
| `title` | yes | Slide title |
| `body` | yes (use `""` for section dividers) | Main content (Markdown OK). Place `{{name}}` to mark where data renders. |
| `suggested_layout` | recommended (non-divider slides) | Free-text hint to the downstream pptx-AI. Not a strict instruction. |
| `data` | optional | Map of `name → {type, source, ...}`. Referenced from `body` via `{{name}}`. |
| `speaker_notes` | optional | Speaker notes. |
| `sources` | optional | Provenance for **prose claims** that cite data but render no chart/table. List of `{claim, source}`. Like `data.*.source`, it is QA-checked in Step 6 — but with a softer, semantic "does the source support this claim?" test rather than exact value matching (there are no structured values to compare). |

Each entry inside `data` has these common fields:

| Sub-field | Required | Purpose |
|---|---|---|
| `type` | yes | One of: `bar_chart`, `line_chart`, `histogram`, `table`, `image` |
| `source` | recommended | Lineage breadcrumb: where the inline table came from. Formats: `"./data/foo.csv"`, `"./data/foo.xlsx, sheet: SheetName"`, `"./report.pdf, page: 7"`, `"./deck.pptx, slide: 3"`. A `page:`/`slide:` locator is **required** for PDF/PPTX. Used by the QA step (Step 6): structured sources (CSV/Excel) get exact value-matching, unstructured ones (PDF/PPTX) get a softer semantic check. Omit for `image` (use `path` instead). |
| (type-specific fields) | varies | See per-type schemas below |

Data types and required fields:

**bar_chart / line_chart**
```yaml
type: bar_chart
source: "./data/q3_financials.xlsx, sheet: Sales_Trend"
x_axis: "X axis label"
y_axis: "Y axis label"
categories: ["Q1", "Q2", "Q3"]
series:
  - name: "2024"
    values: [100, 120, 145]
  - name: "2025"
    values: [110, 135, 168]
```

**histogram**

A histogram shows the distribution of a single variable over pre-binned intervals — not grouped categories, so it does **not** use `categories`/`series`. Use `bins` (the interval labels) and `frequencies` (the count per bin). The narrative's inline table is expected to already be a frequency table (bin → count).
```yaml
type: histogram
source: "./data/scores.csv"
x_axis: "Score range"
y_axis: "Count"
bins: ["0-20", "20-40", "40-60", "60-80", "80-100"]
frequencies: [3, 12, 45, 30, 10]
```

**table**
```yaml
type: table
source: "./data/segments.csv"
headers: ["Segment", "Customers", "Revenue"]
rows:
  - ["Enterprise", 45, 112]
  - ["Mid-market", 180, 38]
  - ["SMB", 620, 18]
```

**image**
```yaml
type: image
path: "./images/team.jpg"
caption: "Optional caption shown on the slide"
alt_text: "Optional accessibility description"
```

### Cell values: number vs string

For `categories`, `series.values`, `frequencies`, and `rows` (in tables), use this rule:

- **Number literal** (`45`, `168`, `100`, `12.5`): raw counts and measurements that the downstream pptx-AI may want to format, sum, or chart numerically
- **String literal** (`"+24%"`, `"$168M"`, `"High"`, `"Done"`): pre-formatted display values that include a unit, sign, currency, or qualitative label

Rule of thumb: if the cell needs a non-numeric character (`%`, `+`, `$`, units, status labels) to be meaningful when displayed, keep it as a string. Otherwise use a number.

**Exception — chart numeric fields**: `series.values` and `frequencies` feed numeric chart axes, so they must stay plain numbers; never wrap them in a unit or symbol (write `168`, not `"$168M"`). Put the unit in the axis label instead (e.g., `y_axis: "Revenue ($M)"`). Pre-formatted strings belong only in `table` rows, where nothing is plotted. (`categories` may be strings — they are axis labels, not plotted magnitudes.)

Example mixed row in a table:
```yaml
rows:
  - ["Enterprise", 45, 112, "+24%"]   # text, int, int, formatted percentage
  - ["Total", 845, 168, "+20%"]
```

YAML formatting rules:
- Use **2-space indentation** (the standard YAML convention; readability is much better than 4 spaces when nesting `data → chart → series`)
- Use `|` (literal block scalar) for multi-line strings — preserves the newlines in `body` and `speaker_notes`
- Wrap titles and any string containing `:`, `#`, `|`, or `>` in double quotes
- Lists of small primitives (categories, values) can use flow style `[1, 2, 3]`

A complete worked example is in `references/example_output.yaml`, paired with the input in `references/example_narrative.md`. **Read these before writing your first YAML** — they show conventions for title slides, section dividers, bullet slides, chart slides, table slides, two-column comparison slides, image slides, and closing slides.

## Workflow

### Step 1: Read the input

- If a file path was given, Read it
- If text was pasted, use it directly
- If neither, ask: "Where is the narrative document?"

### Step 2: Analyze the document

Extract the following without rewriting the user's content:

- **Metadata**: title (H1 or top), and any author/date/audience/duration lines near the top
- **Slide candidates**: each `##` typically becomes one or more slides; long `##` sections may split across multiple slides
- **Inline data tables**: Markdown tables within sections are the **primary source** of chart/table data. Lift them as-is into the `data:` block of the corresponding slide. Do not paraphrase or aggregate numbers
- **Data source breadcrumbs**: parenthetical patterns like `(Source: ./path.csv)`, `(Source: ./data/foo.xlsx, sheet: SheetName)`, `(Source: ./report.pdf, page: 7)`, `(Source: ./deck.pptx, slide: 3)`, `(Source: path)`. Capture these as lineage metadata, keeping any `page:`/`slide:` locator (QA needs it). **Do not read the referenced files during generation** — the inline tables in the narrative are authoritative here. (They are read only later, by the Step 6 QA subagent, to verify the inline tables against their source.)
- **Image references**: parenthetical `(Image: path)`, or Markdown `![alt](path)`
- **Numbers embedded in prose** (e.g., "Q3 reached a record high of $168 million"): use as supporting facts in the body text. Prefer the adjacent inline table for the chart `data:` block when one exists
- **Prose-claim citations**: a `(Source: ...)` breadcrumb attached to a prose sentence that renders no table or chart of its own. Collect these into the slide's `sources` list, paired with the claim they back. They render no visual but are QA-checked for claim support in Step 6
- **Tone**: formal/casual, optimistic/cautious, internal/external audience
- **Anticipated Q&A**: often appears in a closing section

Do not invent data the narrative doesn't contain. If a slide would obviously benefit from a chart but neither the prose nor an inline table provides the data, surface that in Step 3 and ask the user.

### Step 3: Clarify with the user

Use AskUserQuestion. Batch related questions into one call (the tool accepts up to 4 questions).

Common questions:

1. **Target slide count** — Derive a baseline from *this* document rather than using fixed cutoffs: roughly one slide per distinct idea (a long `##` section may split into 2-3 slides; several short ones may merge). Show it and ask: "I see roughly N sections → about M slides at one-idea-per-slide. Target?" Offer three options scaled to that baseline M, not fixed bands:
   - **Concise** — compress below M (merge related sections, drop secondary charts)
   - **Standard** — about M (~one slide per section/idea)
   - **Detailed** — expand above M (split dense sections, add a chart per data table)

   Fill the option labels with the concrete numbers you derived (e.g. "Concise (~8) / Standard (~13) / Detailed (~20)") so they track this document's size — a short memo and a 40-page report should land on very different numbers.
2. **Information density per slide** — "Sparse (one idea per slide)" / "Balanced" / "Dense (more content per slide)"
3. **Missing data sources** — For every chart/table the prose mentions without a path, ask. Don't make paths up
4. **Proactive additions** — If a section would clearly be strengthened by a chart not in the prose, suggest it: "Section X talks about trend Y. A line chart would help — do you have the data?"
5. **Audience/tone** — only if unclear from the document

Skip questions that already have clear answers. Over-asking is friction.

#### When running non-interactively

If `AskUserQuestion` is not available (e.g., this skill was invoked by a parent agent, a script, or a test harness with no human in the loop), do **not** block. Instead:

- Use these defaults: **target slide count = the document-derived baseline (~one slide per distinct idea)**, **density = balanced**, **tone = inferred from the document**
- For missing data: omit the chart rather than fabricating numbers
- In the final summary (Step 7), list every question you would have asked and what default you took, so the caller can decide whether to re-run with overrides

The reason: skills should degrade gracefully into batch/automated contexts. Forcing an interactive prompt when there's no human will hang the pipeline.

### Step 4: Generate the YAML

Map the document to slides:

- **Title slide**: title + body containing author/date/audience as subtitle-like lines; `suggested_layout: "Title Slide: Large centered title, with department name and date in smaller text below"`
- **Agenda slide** (if the document has an executive summary or section list): numbered list of sections
- **Section divider slides** for major `##` transitions: `body: ""`, `suggested_layout: "Section Divider: Large centered title only"`
- **Content slides**: title + prose summary (1-3 short paragraphs or bullets) + `{{placeholder}}` where any data lives + `data:` block
- **Closing block** (3 slides, in this order, as a deliberate pattern):
  1. Section divider with title like "Conclusion" — body is `""`, signals the wrap-up
  2. Recap slide — 2-4 bullets capturing the key takeaways (often Markdown bullets pulled from the final section of the narrative)
  3. Thank-you slide — title like "Thank you", body holds "Q&A", and `speaker_notes` carries the anticipated questions extracted from the document

  This 3-slide ending creates a natural rhythm: pause → recap → handover to Q&A. Don't collapse into a single slide unless the document is very short (<5 slides total).

For each non-divider slide, set a `suggested_layout` that reflects the slide's character. Examples:
- Bullet slide → `"Bullet list: N items stacked vertically in a larger font"`
- Chart slide → `"One-line comment on top, a large [bar|line|histogram] chart centered below"`
- Table slide → `"Table placed large in the center of the slide"`
- Two-column comparison → `"2-column: XXX on the left, YYY on the right"`
- Image slide → `"Large image centered, with a comment on top"`

When the narrative contains an inline data table, lift it into a structured `data` entry. Example:

Narrative excerpt:
```markdown
Revenue kept growing through 2025; Q3 reached a record high of $168 million, up 15.9% year-over-year.

| Quarter | 2024 | 2025 |
|---------|-----:|-----:|
| Q1      |  100 |  110 |
| Q2      |  120 |  135 |
| Q3      |  145 |  168 |

(Source: ./data/q3_financials.xlsx, sheet: Sales_Trend)
```

Becomes:
```yaml
body: |
  Quarterly revenue kept growing through 2025. Q3 reached a record high of $168 million.

  {{revenue_trend}}
data:
  revenue_trend:
    type: bar_chart
    source: "./data/q3_financials.xlsx, sheet: Sales_Trend"
    x_axis: "Quarter"
    y_axis: "Revenue ($M)"
    categories: ["Q1", "Q2", "Q3"]
    series:
      - name: "2024"
        values: [100, 120, 145]
      - name: "2025"
        values: [110, 135, 168]
```

Notice the `source:` field. This breadcrumb makes the data verifiable: Step 6 (QA verification) reads the source file and cross-checks against the values above. Always include `source` when the narrative provided a data-source reference.

When a prose sentence carries a `(Source: ...)` breadcrumb but no table/chart, record it at the slide level under `sources` instead. It renders no visual, but Step 6 QA still checks whether the source supports the claim (a softer, semantic check than chart value-matching):

```yaml
body: |
  We are growing ~2x faster than our nearest competitor.
sources:
  - claim: "growing ~2x faster than nearest competitor"
    source: "./data/market_share.csv"
```

### Step 5: Write to file

Write the YAML to the default path defined in the [Output](#output) section (ask first if the input was pasted text with no destination). Confirm the final path back to the user in your summary.

### Step 6: QA verification (subagent)

After the YAML is on disk, spawn a subagent (use the Agent tool, `subagent_type: general-purpose`) to verify data integrity against the source files. Delegating to a subagent keeps the main flow lean and isolates the file-reading concern.

The subagent reads the YAML, opens every referenced source file, cross-checks the data, and reports back slide-by-slide. It only sees the prompt you hand it — not this skill — so the prompt below is self-contained. Adapt paths as needed:

```
QA task: verify the data in this slide-deck YAML against its source files.

YAML path: <absolute-path-to-yaml>
Working directory for resolving relative source paths: <usually the YAML's directory>

1. Open the YAML. For every source reference — both `data:` entries with a `source:` field and slide-level `sources` entries — locate and open the referenced file:
   - CSV: read it directly (use head/cat for large files)
   - Excel: use Python via Bash. pandas + openpyxl are installed at /opt/uv-venv. A one-liner like
       /opt/uv-venv/bin/python -c "import pandas as pd; print(pd.read_excel('<path>', sheet_name='<sheet>').to_csv(index=False))"
     works; the sheet name comes after "sheet:" in the source string
   - PDF: read only the cited page (number comes after "page:"). A one-liner like
       /opt/uv-venv/bin/python -c "import pdfplumber; pg=pdfplumber.open('<path>').pages[<page>-1]; print(pg.extract_text()); print(pg.extract_tables())"
     works. If the page is a scan with no extractable text, OCR it (pdf2image + pytesseract, lang 'eng' or 'jpn'), or try: pdftotext -f <page> -l <page> '<path>' -
   - PPTX: convert the deck to Markdown with `markitdown '<path>'` (the binary is on PATH at /opt/uv-venv/bin) and find the cited slide (number comes after "slide:")
   - If the file is missing, the sheet/page/slide doesn't exist, or extraction yields nothing, record the issue and move on (don't crash)
2. Compare the YAML against the source:
   - bar/line charts: do `categories` align with the source's x-axis column, and `series.values` with the series columns?
   - histograms: do `bins` align with the interval labels, and `frequencies` with the per-bin counts?
   - tables: do `headers` and `rows` correspond to the source rows for the relevant subset?
   - slide-level `sources` (prose claims): no structured value to match — run a softer, semantic check: does the source plausibly *support* the claim text (e.g., does the data back "~2x faster than competitors")? Don't demand exact figures; flag only clear contradictions or wholly unsupported claims
   - PDF/PPTX sources (any type, including chart/table): extraction from these is unstructured and lossy, so use the same softer semantic check — does the cited page/slide plausibly *contain or support* the YAML's numbers? Treat minor extraction noise as "can't-confirm", not "discrepancy"
   - Allow reasonable interpretation: when the YAML is a clear subset/aggregate of the source, mark it "summarized", not "discrepancy"
3. Report slide-by-slide:
   - ✓ verified (chart/table data matches, or a prose claim is clearly supported)
   - ⚠ summarized / can't-confirm (an aggregated/filtered view, or a plausible-but-unsettled claim — usually fine, but flag it)
   - ✗ discrepancy / contradicted (specifics: "YAML Q1 2024 = 100, source = 102"; or a claim the source contradicts)
   - ✗ source not accessible (file missing / unreadable / sheet, page, or slide not found)
   - ⊘ skipped (no `source`)

Keep the report under 400 words. Highlight discrepancies first so they're easy to spot.
```

After the subagent reports back, surface its findings to the user. If there are real discrepancies, ask whether to:
- Update the YAML to match the source (recommended when the source is authoritative)
- Keep the YAML as-is (when the narrative deliberately aggregated/rounded)
- Investigate manually

If all source files are inaccessible (e.g., the upstream pipeline hasn't produced them yet, or the user is testing with paths that don't exist), the subagent will report all ⊘/✗ — that's a valid outcome. Note it and continue.

### Step 7: Summarize and offer revision

Tell the user:
- Where the YAML was written
- How many slides were generated
- QA findings from Step 6 (verified / summarized / discrepancies / inaccessible)
- How many chart/table entries were emitted **without** a `source`, and which ones — so the user can spot data that should have carried a breadcrumb (these are valid, just un-cited)
- Any data sources that are still TODOs (the user said they'd provide but haven't)
- If running non-interactively, the list of questions you would have asked and the defaults you took
- Open question: "Anything to refine?"

## Editing an existing deck

This skill also revises a YAML deck that a prior run already produced — not just first-time generation. Because invocation is manual, there is no auto-trigger noise to weigh: when the user explicitly invokes the skill on an existing `.yaml`, follow this path instead of the generation Workflow above.

Inputs: the existing YAML path and the edit instruction — plus, for a re-sync, the updated narrative. If the YAML path is unclear, ask for it. **Always Read the existing YAML first** so edits preserve its structure, slide ordering, and any manual tweaks. Then classify the edit:

### (A) Trivial text edits

Renaming a title, fixing a typo, rewording `body`/`speaker_notes`. These touch no `data:`/`sources:` and no slide structure. Apply directly with Edit — no schema reasoning, no QA. (This is the case the [Out of scope](#out-of-scope) note covers; if the user invoked the skill only for this, it was still fine to handle it.)

### (B) Schema-affecting edits

Changing chart/table values, adding or removing slides, adding or editing a `data:`/`sources:` entry, converting a table to a chart, etc. These obey the same schema rules as generation:

- Follow the [number-vs-string rule](#cell-values-number-vs-string), including the chart-numeric exception (`series.values`/`frequencies` stay plain numbers; units go in the axis label).
- Keep the required `page:`/`slide:` locator on any PDF/PPTX `source`.
- When adding a slide, give it a `suggested_layout`; when editing near the end, preserve the closing 3-slide pattern (divider → recap → thank-you).
- Don't invent data the user didn't supply — same honesty rule as generation.

After any change that touches `data:` or `sources:`, re-run **Step 6 (QA verification)** on the affected slides, then report per **Step 7**.

### (C) Narrative re-sync

The upstream narrative changed and the YAML should catch up. Re-run the generation Workflow against the updated narrative, but treat the existing YAML as the baseline rather than overwriting blindly:

- Infer slide-count/density from the existing deck — don't re-ask in Step 3 what's already settled there; only clarify genuinely new ambiguities.
- Diff the narrative changes and update **only** the affected slides. Preserve hand-tuned titles, `suggested_layout`, `speaker_notes`, and slide ordering wherever the narrative did not change.
- Run **Step 6 (QA)** on the changed slides and summarize per **Step 7**.
- If you cannot cleanly tell what was hand-edited versus generated, surface the conflict and ask before overwriting — do not guess.

## Important principles

- **Layout hints go only in `suggested_layout`**, never inside `body`. The downstream pptx skill decides actual layout.
- **Data file paths (CSV, Excel) are lineage breadcrumbs, not generation-time sources**. Chart and table data comes from the **inline Markdown tables** in the narrative; for the full rule (and the Step 6 QA exception) see [Purpose](#purpose).
- **Respect the upstream author's words**. Lightly compress prose for slide brevity, but don't invent claims or rewrite analysis. If something is unclear, ask the user, don't paper over it.
- **Honest gaps**. If the prose mentions a visualization without an inline table, ask. Do not infer numbers from prose summaries when a structured table was expected.
- **One slide, one idea**. If a `##` section spans multiple distinct topics, split it.
- **Speaker notes carry the depth**. Pull supporting context, caveats, and anticipated questions into `speaker_notes` so the slide itself stays clean.
