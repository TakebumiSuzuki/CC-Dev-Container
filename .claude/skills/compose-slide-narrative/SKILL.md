---
name: compose-slide-narrative
description: Composes a Markdown narrative document (from raw data, existing reports, or user intent) as the upstream input for the narrative-to-slide-outline skill.
disable-model-invocation: true
---

# Compose Slide Narrative

```
[Raw data / docs / user intent] → [THIS SKILL: narrative MD] → [narrative-to-slide-outline: slide YAML] → [pptx skill: .pptx]
```

## Output format

**The narrative file format is specified in `../narrative-to-slide-outline/references/narrative_format.md` — this is the single source of truth for what a valid narrative.md looks like. Read it before writing your first narrative.**

For a complete worked example, read `../narrative-to-slide-outline/references/example_narrative.md` alongside the spec.

This skill adds **writing discipline** on top of that format — most importantly the source-attaches-to-claim rule below. The format spec tells you _what shape the file must take_; this skill tells you _how to decide what goes in it_.

## The Source-attaches-to-claim rule

Every numeric or factual claim is in one of three states. There is no fourth.

1. **Verified** — supporting data exists locally **within the user-specified scope**. Attach a Source breadcrumb (to the table, or inline if qualitative). **Actively hunt for this state** before falling through: scan the in-scope files for names, sheets, or columns that plausibly back the claim. A 30-second look that turns up the supporting CSV converts an un-cited prose claim into a verifiable sourced table — almost always worth doing.
2. **Asserted-without-source** — the user said it; an active search did not turn up a file that backs it. Keep the prose with no Source. In Step 6 ask _where_ that data lives (usually more productive than asking _whether_ to cite it).
3. **Inferred-by-you** — you suspect it from context but the data doesn't directly say it. Mark inline with `[needs-verification]`. **Never invent a Source path.**

The default failure mode for AI-written narratives is fabricating numbers or sources to sound convincing. This rule makes that failure visible instead of silent.

## Workflow

**Two entry points**:

- **New narrative** — start at Step 1 below.
- **Editing an existing narrative.md** — skip to the "Editing an existing narrative.md in a new conversation" subsection at the end of Step 6.

### Step 1: Capture initial intent + scope

Two things only:

1. **Rough goal** — "H1 sales review + strategy", "case study for Y Corp", "risk exploration in this data", etc.
2. **Source scope** — folder or file paths.

If invoked with no context (just `/compose-slide-narrative`), ask: _"What kind of slide narrative do you want, and where is the source material?"_ If only one is missing, ask just for that. Detailed scoping is Step 3's job — don't try to extract it all here.

**Hard rule**: never autonomously scan directories the user did not point at, even ones that look obviously useful like `./data/` next to the working directory.

**Network access**: never. Local files only — no `WebFetch` or remote APIs.

### Step 2: Light scan

Scan the in-scope paths for _cheap_ signal — file names, folder structure, lightweight metadata (Excel sheet names, CSV column headers, row counts, PDF page counts). Defer heavy reading (full content, page-by-page text, computed metrics) to Step 4.

**Python interpreter** (used here and in Step 4): prefer the project's own venv (e.g. `./.venv/bin/python`) if one exists; otherwise fall back to system `python3`. Confirm packages import in the interpreter you picked before relying on them.

Recommended libraries:

- **CSV / Excel** — `pandas` (with `openpyxl` for `.xlsx`)
- **Word** (`.docx`) — `python-docx` (read paragraphs and tables; cite by enclosing heading text)
- **PDF** — `pdfplumber`; fall back to `pdftotext` or `markitdown` for scanned PDFs
- **PPTX** — `python-pptx`
- **Markdown / text** (`.md`, `.txt`) — Read tool
- **Images** — note path + filename only; do not OCR unless asked

### Step 3: Initial scoping dialogue

With the Step 2 inventory in hand, questions can be specific instead of generic — that's why the scan came first. Agree on a **tentative** direction so you know what to read deeply in Step 4. Two things:

1. **Story angle** — the main thread of the narrative.
2. **Audience and duration** — who, how long, plus tone if not obvious.

Use the inventory to make questions specific. Bad: _"What kind of analysis do you want?"_ Good: _"For the H1 sales review, I see q1_sales.csv, q2_sales.csv, and promotion_cost.xlsx. Three angles: (a) sales trend only; (b) strategy/recommendation focus; (c) include promotion-cost ROI as a third pillar. Which fits?"_

Keep it short: 1–2 rounds, not exhaustive — Step 4 will validate against actual data anyway. One-line plan confirmation before moving on.

Style:

- Plain prose for open questions; `AskUserQuestion` only when there's a clean set of discrete options
- Past round 3, you're interrogating — Step 4 findings will refine this anyway

### Step 4: Deep exploration + scope confirmation

Open the files implied by the tentative angle and read enough to evaluate whether the angle holds. Out-of-scope files are not touched.

Then **check in with the user** with what you found:

- What the data supports cleanly
- What's thinner, missing, or contradictory
- Whether a different angle from Step 3's options now looks stronger

The user's response locks the scope. Only then proceed to Step 5. If the user picks a different angle that needs different files, loop: read those, report, confirm.

### Step 5: Draft the narrative

Before writing, ask one final question: **closing Q&A section — yes or no?** Common for board/executive decks, often skipped for status updates, tutorials, short pitches. One short question — don't re-open the scoping dialogue.

If you have not already read `../narrative-to-slide-outline/references/example_narrative.md` (see Output format section), read it now — it is the concrete target shape for your draft.

Then produce the full first draft in one pass. Don't write section-by-section asking for confirmation — get a complete draft on disk, then iterate.

Composition rules:

- **Tables vs. inline citation.** When a section should show data visually, extract just the relevant rows and columns from the source file into an inline Markdown table and attach a Source breadcrumb to it. When the number is just supporting a prose claim and doesn't need its own visualization, skip the table and put an inline `(Source: ...)` at the end of the sentence. The downstream pptx skill turns tables into charts, so embedding a table is a deliberate "render this as a chart" signal.
- **Apply the three-state rule.** See the Source-attaches-to-claim rule above. **If you cannot find supporting data in scope, do not fabricate a Source path** — keep the claim as prose without Source, or mark `[needs-verification]`. Missing numbers → placeholder like `$XX M`, flag in Step 6.
- **Respect the source author when re-formatting an existing document.** Lift structure and claims; compress and reframe for the audience, but don't rewrite the analysis.
- **Images.** Embed an image (`![meaningful alt](path)`) only when the visual itself carries meaning that prose or a table cannot — a team/event photo, product or UI screenshot, logo, or an existing diagram the user supplied or that lives in scope.
- **Closing block**: a Conclusion with Key Takeaways (3–5 bullets) is recommended for most decks but skippable for short talks, tutorials, or case-studies. Include Anticipated Q&A (3–5 questions with brief answers) only if the user said yes above.
- **One slide ≠ one section.** This is a _narrative_, not a deck outline. Write coherent prose with embedded tables; let the downstream skill decide slide breaks.

Write the draft to the output path.

**Default path convention: `./Output/{YYYY-MM-DD}-{slug}/narrative.md`**

- `{YYYY-MM-DD}` — today's date.
- `{slug}` — a short **English** kebab-case identifier derived from the confirmed title/angle (lowercase ASCII, hyphen-separated, e.g. `h1-sales-review`). Always English even when the title is in another language: transliterate or summarize into English. Fall back to `narrative` if no sensible slug can be formed.
- **Collision handling**: if that directory already exists (same theme rebuilt the same day), suffix the directory with `-02`, `-03`, … — e.g. `./Output/2026-05-29-h1-sales-review-02/`.

The folder — not the file — is the unit of work: it is the home for all downstream artifacts of this deck (the slide outline YAML and the final `.pptx`), so the narrative file name stays the fixed `narrative.md`. The user may override this path.

### Step 6: Report and iterate

After writing, report back:

- Output path
- Section count and inline-table count
- Sources cited — number of distinct files referenced
- **Un-cited claims** — list each. User decides: add evidence, accept, or drop.
- **`[needs-verification]` markers** — list each with surrounding sentence. User decides: provide source → cite it; confirm without data → drop the marker, keep as prose; reject → remove or rephrase.
- _"Anything to refine?"_

Revision loop:

- Accept one instruction (or a small batch) per turn
- Apply with the **Edit tool, not Write** — preserves breadcrumbs, ordering, formatting
- One-sentence confirmation of what changed
- For a new claim that needs evidence: check what you already read in Step 4 first, then ask the user where the data is.
- Repeat until the user signals done ("OK", "looks good", "ship it")

**Editing an existing narrative.md in a new conversation**:

- Ask for the narrative path (required)
- Ask if the original data sources are still accessible (only if revisions add new sourced claims)
- Skip Steps 1–5. Read the existing narrative, then run the Step 6 report on it (sources cited, un-cited claims, `[needs-verification]` markers) and enter the revision loop above.

**Exit**: re-run the Step 6 report on the updated file (refreshed lists of citations / un-cited claims / `[needs-verification]` markers), then stop.
