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

Keep your scope narrow: read prose, produce YAML. Do not generate pptx.

**Rule on data files**: during YAML generation (Steps 1-5), do **not** open the referenced data files (CSV, Excel, PDF, PPTX). The narrative's inline tables are authoritative — they are what you transcribe into `data:` blocks. The original data files are read only later, by the QA subagent in Step 6, to verify two things:

1. The inline tables were transcribed correctly from their source.
2. Any prose-claim citations are supported by their sources.

In short: generation trusts the narrative; QA double-checks against the originals. Treating the file paths as lineage breadcrumbs (not generation-time inputs) keeps this skill fast and deterministic, and confines all file I/O for raw data to the QA step.

## Out of scope

This skill is **manual-only**: it runs only when the user invokes it explicitly (see `disable-model-invocation` in the frontmatter), so it never auto-triggers on prose. Once running, step back and redirect if the request is actually one of these:

- Generating the final pptx file — that's a different skill
- A trivial text-only tweak to an existing YAML (rename a title, fix a typo, reword `speaker_notes`) — just do it with Edit; you don't need this skill's machinery

## Editing an existing YAML in a new conversation

YAML files outlive the conversation that created them. A common workflow is to generate the YAML in one thread, then return days later — in a fresh thread — to edit it. This skill supports that as a distinct entry point.

**Use this entry point when** the user wants a non-trivial change to an existing YAML: adding or removing slides, splitting or merging slides, adding a new claim that needs a citation, swapping a chart's data source, restructuring the deck. Trivial text-only tweaks should still go through plain Edit as noted in [Out of scope](#out-of-scope).

### What to ask the user

1. **The YAML path** — required.
2. **The original narrative path** — preferred but optional. Supplying it widens the citation-reuse pool in Step 8; if it's missing, Step 8 operates in degraded mode.

### What to do

1. Read the YAML (and the narrative, if provided).
2. **Skip Steps 1-7. Jump directly to [Step 8](#step-8-iterative-revision-user-driven-loop)**. All operating rules — Edit-tool usage, citation reuse, degraded mode, exit handling (re-run Step 6 then Step 7) — live there.

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
    - PDF with page number: `(Source: ./reports/q3.pdf, page: 7)` — the `page:` locator is **required in both the narrative input and the YAML output** (it tells QA where to look)
    - PowerPoint with slide number: `(Source: ./decks/board.pptx, slide: 3)` — the `slide:` locator is **required in both the narrative input and the YAML output**
    - The same `(Source: ...)` syntax may also be attached **inline to a prose sentence** to cite a claim that renders no table or chart of its own (e.g., `...growing ~2x faster than competitors (Source: ./data/market_share.csv).`). Capture these as slide-level `prose_sources` (see schema)
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
    prose_sources:
      - claim: "the prose claim being cited"
        source: "./data/foo.csv"
```

The key under `data:` (e.g. `placeholder_name` above) MUST match the `{{placeholder_name}}` token in `body`. The narrative does not carry these names, so this skill coins them from context in short `snake_case` (e.g. `revenue_trend`, `team_photo`, `segment_breakdown`).

Field reference:

| Field              | Required                            | Purpose                                                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`            | yes                                 | Slide title                                                                                                                                                                                                                                                                                                  |
| `body`             | yes (use `""` for section dividers) | Main content (Markdown OK). Place `{{name}}` to mark where data renders.                                                                                                                                                                                                                                     |
| `suggested_layout` | recommended                         | Free-text hint to the downstream pptx-AI. Not a strict instruction.                                                                                                                                                                                                                                          |
| `data`             | optional                            | Map of `name → {type, source, ...}`. Referenced from `body` via `{{name}}`.                                                                                                                                                                                                                                  |
| `speaker_notes`    | optional                            | Speaker notes.                                                                                                                                                                                                                                                                                               |
| `prose_sources`    | optional                            | Provenance for **prose claims** that cite data but render no chart/table. List of `{claim, source}`. The `source` string follows the same format as `data.*.source` — including the required `page:`/`slide:` locator for PDF/PPTX. Like `data.*.source`, it is QA-checked in Step 6 — but with a softer, semantic "does the source support this claim?" test rather than exact value matching (there are no structured values to compare). |

Each entry inside `data` has these common fields:

| Sub-field              | Required          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                 | yes               | One of: `bar_chart`, `line_chart`, `histogram`, `table`, `image`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `source`               | yes (see desc)    | Include whenever the narrative supplies a `(Source: ...)` breadcrumb. If the narrative has an inline table **without** a breadcrumb (rare — the Input section assumes one is always present), ask the user in Step 3 for the source rather than omitting it silently or guessing a path. Lineage breadcrumb: where the inline table came from. Formats: `"./data/foo.csv"`, `"./data/foo.xlsx, sheet: SheetName"`, `"./report.pdf, page: 7"`, `"./deck.pptx, slide: 3"`. A `page:`/`slide:` locator is **required** for PDF/PPTX. Used by the QA step (Step 6): structured sources (CSV/Excel) get exact value-matching, unstructured ones (PDF/PPTX) get a softer semantic check. Omit for `image` (use `path` instead). |
| (type-specific fields) | varies            | See per-type schemas below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

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
  - ["Enterprise", 45, 112, "+24%"] # text, int, int, formatted percentage
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

Recognize each pattern below using the syntax defined in the [Input](#input) section; here we focus on **what to extract and how to handle priority/conflicts**, not on the syntax. Do this without rewriting the user's content:

- **Metadata**: title and any author/date/audience/duration lines
- **Slide candidates**: each `##` typically becomes one or more slides; long sections may split, short adjacent ones may merge
- **Inline data tables**: the **primary source** of chart/table data. Lift as-is into `data:`. Do not paraphrase or aggregate numbers
- **Data source breadcrumbs**: capture as lineage metadata, keeping any `page:`/`slide:` locator (QA needs it). **Do not open the referenced files during generation** — see [Purpose](#purpose) for the rationale
- **Image references**: capture path (plus caption / alt text when present)
- **Numbers embedded in prose**: use as supporting facts in body text. Prefer the adjacent inline table for the `data:` block when one exists. **If only prose numbers are available (no inline table), do not fabricate a chart from them** — surface the gap in Step 3 and ask the user
- **Prose-claim citations**: collect into the slide's `prose_sources` list, paired with the claim they back (QA-checked in Step 6)
- **Tone**: formal/casual, optimistic/cautious, internal/external audience
- **Anticipated Q&A**: often appears in a closing section

Do not invent data the narrative doesn't contain. If a slide would obviously benefit from a chart but neither the prose nor an inline table provides the data, surface that in Step 3 and ask the user.

### Step 3: Clarify with the user

Use AskUserQuestion. Batch related questions into one call (the tool accepts up to 4 questions).

Common questions:

1. **Target slide count** — Derive a baseline from _this_ document rather than using fixed cutoffs: roughly one slide per distinct idea (a long `##` section may split into 2-3 slides; several short ones may merge). Show it and ask: "I see roughly N sections → about M slides at one-idea-per-slide. Target?" Offer three options scaled to that baseline M, not fixed bands:
    - **Concise** — compress below M (merge related sections, drop secondary charts)
    - **Standard** — about M (~one slide per section/idea)
    - **Detailed** — expand above M (split dense sections, add a chart per data table)

    Fill the option labels with the concrete numbers you derived (e.g. "Concise (~8) / Standard (~13) / Detailed (~20)") so they track this document's size — a short memo and a 40-page report should land on very different numbers.

2. **Body verbosity** — "Terse (keywords and short bullets; the speaker carries the content, so push depth into `speaker_notes`)" / "Balanced (mixed bullets and short sentences)" / "Verbose (full sentences and prose paragraphs; the slide should read on its own as a document)". This is orthogonal to slide count (Q1): few slides can still be terse, and many slides can still be verbose. Q1 decides how the narrative is partitioned; Q2 decides how each slide is written.
3. **Missing data sources** — For every chart/table where the narrative didn't supply a source (whether the inline table lacks a breadcrumb, or the prose mentions data with no table at all), ask. Don't make paths up
4. **Proactive additions** — If a section would clearly be strengthened by a chart not in the prose, suggest it: "Section X talks about trend Y. A line chart would help — do you have the data?"
5. **Audience/tone** — only if unclear from the document

Skip questions that already have clear answers. Over-asking is friction.

#### When running non-interactively

If `AskUserQuestion` is unavailable (parent agent, script, test harness), don't block — use these defaults: slide count = document-derived baseline, body verbosity = balanced, tone = inferred from the document, missing data = omit the chart (never fabricate numbers). In the Step 7 summary, list every skipped question and the default taken so the caller can re-run with overrides.

### Step 4: Generate the YAML

Map the document to slides:

- **Title slide**: title + body containing author/date/audience as subtitle-like lines; `suggested_layout: "Title Slide: Large centered title, with date in smaller text below"`
- **Agenda slide** (if the document has an executive summary or section list): numbered list of sections
- **Section divider slides** for major `##` transitions: `body: ""`, `suggested_layout: "Section Divider: Large centered title only"`
- **Content slides**: title + prose summary (1-3 short paragraphs or bullets) + `{{placeholder}}` where any data lives + `data:` block
- **Closing block** (3 slides, in this order, as a deliberate pattern):
    1. Section divider with title like "Conclusion" — body is `""`, signals the wrap-up
    2. Recap slide — 2-4 bullets capturing the key takeaways (often Markdown bullets pulled from the final section of the narrative)
    3. Thank-you slide — title like "Thank you", body holds "Q&A", and `speaker_notes` carries the anticipated questions extracted from the document

    Collapse into a single slide only when the document is very short (<5 slides total).

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
| ------- | ---: | ---: |
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

When a prose sentence carries a `(Source: ...)` breadcrumb but no table/chart, record it at the slide level under `prose_sources` instead. It renders no visual, but Step 6 QA still checks whether the source supports the claim (a softer, semantic check than chart value-matching):

```yaml
body: |
  We are growing ~2x faster than our nearest competitor.
prose_sources:
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

Use a Python where `pandas`, `openpyxl`, `pdfplumber`, `python-pptx` are all importable — check the project's venv first (e.g. `./.venv/bin/python`), then any system-wide venv, then plain `python3`. `pdf2image`/`pytesseract`/`markitdown`/`pdftotext` are available as fallbacks for scanned PDFs or text-heavy slides.

1. For every referenced file — `data:` entries with `source:`, slide-level `prose_sources` entries, and `type: image` entries (which use `path:`) — open or stat it. Sheet name follows "sheet:", page/slide number follows "page:"/"slide:" in the source string. For `type: image`, do an existence check only — never inspect contents. If a file/sheet/page/slide is missing or extraction yields nothing, record it and continue (don't crash).

2. Compare YAML against source:
   - Charts/tables from CSV/Excel: `categories`/`series.values`/`bins`/`frequencies`/`headers`/`rows` must match the source values
   - `prose_sources` and any PDF/PPTX source: softer semantic check — does the source plausibly *support* the claim or numbers? Treat extraction noise as "can't-confirm", not "discrepancy". Flag only clear contradictions.
   - YAML that is a clear subset/aggregate of the source → "summarized", not "discrepancy"

3. Report slide-by-slide, discrepancies first:
   - ✓ verified — data matches / claim supported / image file exists
   - ⚠ summarized or can't-confirm — aggregated view or plausible-but-unsettled claim
   - ✗ discrepancy — specifics (e.g., "YAML Q1 = 100, source = 102") or contradicted claim
   - ✗ source not accessible — missing file or invalid locator
   - ⊘ skipped — entry has no source to verify

Keep the report under 400 words.
```

After the subagent reports back, surface its findings to the user. If there are real discrepancies, ask whether to:

- Update the YAML to match the source
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
- Open question: "Anything to refine?" — if yes, proceed to Step 8; if no, **the workflow ends here**. Step 7 is the sole termination point; any Step 8 → Step 6 → Step 7 cycle always exits through this same question.

### Step 8: Iterative revision (user-driven loop)

This step is the editing loop, reached from two entry points:

- **After Step 7** in the fresh-creation flow — the user will often want to refine the just-generated YAML. Skip if they're already satisfied.
- **Direct invocation** to edit an existing YAML (see [Editing an existing YAML in a new conversation](#editing-an-existing-yaml-in-a-new-conversation)) — Step 8 is the whole point of the invocation. (Do not re-ask the Step 3 clarifications — the existing YAML already embodies those answers.)

Typical revisions: split a slide into two, add a bullet, fold in data they forgot, reorder slides, drop something, etc.

**Scope shift**: in Steps 1-5 the narrative is the source of truth and you must not invent claims. In Step 8 that constraint relaxes — the user's revision instruction is the new authority. You may reorder, restate, split, merge, or drop content freely to honor the request. (You are still not free to fabricate data — see below.)

**Rules for new data introduced in Step 8**:

If a revision adds a new prose claim or a new chart/table that needs a data source, the source must come from one of two places:

1. **Reuse an existing citation**: scan the current YAML (`data.*.source`, `prose_sources[*].source`) and the original narrative for a source that plausibly covers the new claim. If you find a candidate, **confirm the match with the user before reusing it** — semantic matching by an LLM is not reliable enough to silently bind a source to a new claim. (**Degraded mode**: when the narrative isn't available, the reuse pool shrinks to YAML-only sources, so falling through to rule 2 is more common.)
2. **Ask the user for the source**: if no existing citation fits, ask. Do not make up a path.

If the user cannot supply a source, keep the addition as prose (no chart, no `prose_sources` entry) or drop the addition — never invent a `source:` value.

**Loop mechanics**:

- Accept one revision instruction (or a small batch) per turn
- Apply via the Edit tool, not Write — preserve indentation, quoting style, literal block scalars (`|`), and the existing field order
- Briefly confirm what changed (one sentence)
- Repeat until the user signals they are done (e.g. "OK", "looks good", "run QA")

**Exiting Step 8**:

When the user is satisfied, **re-run Step 6 (QA) in full against the updated YAML** — not just on the bits Step 8 changed. Step 8 edits can rearrange, restate, or merge content in ways that make diff-based partial QA brittle; a full re-verification is simpler and safer. Then re-run Step 7 with the updated summary.

## Important principles

- **Layout hints go only in `suggested_layout`**, never inside `body`. The downstream pptx skill decides actual layout.
- **Respect the upstream author's words**. Lightly compress prose for slide brevity, but don't invent claims or rewrite analysis. If something is unclear, ask the user, don't paper over it.
- **Honest gaps**. If the prose mentions a visualization without an inline table, ask. Do not infer numbers from prose summaries when a structured table was expected.
- **One slide, one idea**. If a `##` section spans multiple distinct topics, split it.
- **Speaker notes carry the depth**. Pull supporting context, caveats, and anticipated questions into `speaker_notes` so the slide itself stays clean.
