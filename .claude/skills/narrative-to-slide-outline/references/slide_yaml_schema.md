# Slide-deck YAML schema

The structured YAML intermediate that flows between the pipeline stages
(`narrative-to-slide-outline` produces it, `compose-pptx` consumes it).
This file is the single source of truth for the format itself — the
*generation guidance* (how to map a narrative into this shape) lives in the
producer skill's `SKILL.md`.

## Top-level schema

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

The key under `data:` (e.g. `placeholder_name` above) MUST match the
`{{placeholder_name}}` token in `body`. The narrative does not carry these
names, so the producer coins them from context in short `snake_case`
(e.g. `revenue_trend`, `team_photo`, `segment_breakdown`).

## Field reference

| Field              | Required                            | Purpose                                                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`            | yes                                 | Slide title                                                                                                                                                                                                                                                                                                  |
| `body`             | yes (use `""` for section dividers) | Main content (Markdown OK). Place `{{name}}` to mark where data renders.                                                                                                                                                                                                                                     |
| `suggested_layout` | recommended                         | Free-text hint to the downstream pptx-AI. Not a strict instruction.                                                                                                                                                                                                                                          |
| `data`             | optional                            | Map of `name → {type, source, ...}`. Referenced from `body` via `{{name}}`.                                                                                                                                                                                                                                  |
| `speaker_notes`    | optional                            | Speaker notes.                                                                                                                                                                                                                                                                                               |
| `prose_sources`    | optional                            | Provenance for **prose claims** that cite data but render no chart/table. List of `{claim, source}`. The `source` string follows the same format as `data.*.source` — including the required `heading:`/`page:`/`slide:` locator for Word/PDF/PPTX. Like `data.*.source`, it is QA-checked — but with a softer, semantic "does the source support this claim?" test rather than exact value matching (there are no structured values to compare). |

Each entry inside `data` has these common fields:

The `source` value mirrors the **content** of the narrative's `(Source: ...)`
breadcrumb — the text between `(Source: ` and `)`, without the parentheses or
the `Source:` prefix. For example, `(Source: ./data/foo.xlsx, sheet: Sales)` in
the narrative becomes `source: "./data/foo.xlsx, sheet: Sales"` in the YAML.

| Sub-field              | Required          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                 | yes               | One of: `bar_chart`, `line_chart`, `histogram`, `table`, `image`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `source`               | conditional       | Required whenever the narrative provides a `(Source: ...)` breadcrumb. If an inline table lacks a breadcrumb, ask the user — never guess a path. Omit for `image` (use `path` instead). Format and locator rules: see `narrative_format.md`. |
| (type-specific fields) | varies            | See per-type schemas below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Data types and required fields

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

A histogram shows the distribution of a single variable over pre-binned
intervals — not grouped categories, so it does **not** use
`categories`/`series`. Use `bins` (the interval labels) and `frequencies` (the
count per bin). The narrative's inline table is expected to already be a
frequency table (bin → count).

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
caption: "Optional caption shown on the slide (also serves as the accessibility description)"
```

The `caption` is sourced from the Markdown image's alt text
(`![alt text](path)`) and doubles as both the on-slide caption and the
accessibility description — the narrative format only carries one string, so do
not invent a separate accessibility-only description.

## Cell values: number vs string

For `categories`, `series.values`, `frequencies`, and `rows` (in tables), use
this rule:

- **Number literal** (`45`, `168`, `100`, `12.5`): raw counts and measurements
  that the downstream pptx-AI may want to format, sum, or chart numerically
- **String literal** (`"+24%"`, `"$168M"`, `"High"`, `"Done"`): pre-formatted
  display values that include a unit, sign, currency, or qualitative label

Rule of thumb: if the cell needs a non-numeric character (`%`, `+`, `$`, units,
status labels) to be meaningful when displayed, keep it as a string. Otherwise
use a number.

**Exception — chart numeric fields**: `series.values` and `frequencies` feed
numeric chart axes, so they must stay plain numbers; never wrap them in a unit
or symbol (write `168`, not `"$168M"`). Put the unit in the axis label instead
(e.g., `y_axis: "Revenue ($M)"`). Pre-formatted strings belong only in `table`
rows, where nothing is plotted. (`categories` may be strings — they are axis
labels, not plotted magnitudes.)

Example mixed row in a table:

```yaml
rows:
  - ["Enterprise", 45, 112, "+24%"] # text, int, int, formatted percentage
  - ["Total", 845, 168, "+20%"]
```

## YAML formatting rules

- Use **2-space indentation** (the standard YAML convention; readability is much
  better than 4 spaces when nesting `data → chart → series`)
- Use `|` (literal block scalar) for multi-line strings — preserves the newlines
  in `body` and `speaker_notes`
- Wrap titles and any string containing `:`, `#`, `|`, or `>` in double quotes
- Lists of small primitives (categories, values) can use flow style `[1, 2, 3]`

A complete worked example is in `example_output.yaml`, paired with the input in
`example_narrative.md`. **Read these before writing or parsing your first
YAML** — they show conventions for title slides, section dividers, bullet
slides, chart slides, table slides, two-column comparison slides, image slides,
and closing slides.
