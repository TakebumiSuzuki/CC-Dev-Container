# Narrative Markdown Format

A complete worked example is in `./example_narrative.md` — read this spec together with that example.

---

## Document skeleton

Legend: ✓ required, ◯ recommended, △ optional / conditional

```markdown
# {{Title}}                          ✓ required (H1, top of document)

Author: ...                          ◯ recommended (metadata block)
Date: YYYY-MM-DD
Audience: ...
Duration: ... minutes

## Executive Summary                 ◯ recommended

## {{Section}}                       ✓ at least one body section required

### {{Subsection}}                   △ when a section spans multiple distinct ideas

Prose framing.

| Header | Header |                   ◯ inline table whenever the section has chartable numbers
| ------ | -----: |
| ...    | ...    |

(Source: ./path/to/source)           ✓ whenever data is shown or a factual claim is made

Prose interpretation.

## Conclusion                        ◯ recommended

### Key Takeaways                    ◯ recommended

### Anticipated Q&A                  △ if requested
- *Question?* Answer.
```

---

## Title and metadata

- **Title**: a single H1 (`# ...`) at the top of the document.
- **Metadata block**: plain `Key: value` lines immediately under the title. Common keys: `Author`, `Date` (ISO `YYYY-MM-DD`), `Audience`, `Duration`. Other keys are tolerated but only the four above carry defined meaning in this format.

---

## Executive Summary

A short summary section near the top of the document, recommended for executive or business narratives but skippable for short talks, tutorials, or case studies.

---

## Sections

- `##` headings mark major sections.
- `###` headings split a section into sub-topics when one section spans multiple distinct ideas.

---

## Inline tables

When a section presents structured data as a discrete element, embed it as a Markdown table. Cells may contain either numbers (e.g., revenue by quarter) or short text/labels (e.g., wins vs. challenges).

```markdown
| Quarter | 2025 | 2026 |
| ------- | ---: | ---: |
| Q1      |  142 |  168 |
| Q2      |  151 |  187 |

(Source: ./data/q2_2026_financials.xlsx, sheet: Revenue_Trend)
```

Rules:

- The inline table is **authoritative** for its content — when the prose summarizes or rounds, the table carries the exact values (numbers or text).
- A Source breadcrumb (see below) MUST be attached to every table that has external data behind it.
- If a value or fact is only mentioned in passing and is not the section's focus, do **not** wrap it in a table. Use the inline-source form instead (see below).

---

## Source breadcrumbs

A Source breadcrumb records **where the data came from** — the file and the precise location inside it that backs the table or claim above. An incorrect or imprecise locator makes the source unverifiable.

Syntax — one breadcrumb per source, immediately after the relevant table (or inline in a prose sentence, see next subsection):

| File type | Format | Required locator |
| --------- | ------ | ---------------- |
| CSV       | `(Source: ./data/foo.csv)`                              | — |
| Excel     | `(Source: ./data/foo.xlsx, sheet: SheetName)`           | `sheet:` |
| PDF       | `(Source: ./reports/x.pdf, page: 7)`                    | `page:` |
| PPTX      | `(Source: ./decks/y.pptx, slide: 3)`                    | `slide:` |

### Inline source on a prose claim

The same `(Source: ...)` syntax may attach **inline to a prose sentence** to cite a qualitative claim that doesn't have its own table. Place the breadcrumb just before the sentence's terminal punctuation:

```markdown
We are tracking roughly 2x the growth rate of our nearest competitor (Source: ./data/market_intel.csv).
```

---

## Image references

Use the standard Markdown image syntax:

```markdown
![Q2 2026 revenue org all-hands at the June kickoff in Lisbon](./images/q2_team_lisbon.jpg)
```

The alt text should describe the image meaningfully — it serves both as the accessibility description and as the caption.

---

## Conclusion section

A Conclusion section at the end of the document is recommended for executive or business narratives but skippable for short talks, tutorials, or case studies.

- **`## Conclusion`** — a short wrap-up paragraph framing what the narrative argued for.
- **`### Key Takeaways`** — 3–5 bullet points capturing the headline conclusions.
- **`### Anticipated Q&A`** — included only if requested. 3–5 *question → answer* pairs covering likely audience questions, formatted as `- *Question?* Answer.` for each entry.
