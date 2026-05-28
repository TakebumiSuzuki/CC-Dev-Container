---
name: compose-slide-narrative
description: Compose a Markdown narrative document from raw data, an existing report, or a user's high-level intent. The narrative is the upstream input for the narrative-to-slide-outline skill (narrative → YAML → pptx pipeline). Manual-only: invoke explicitly with /compose-slide-narrative.
disable-model-invocation: true
---

# Compose Slide Narrative

## Purpose

Produce a Markdown narrative document that the downstream `narrative-to-slide-outline` skill can convert into slide YAML.

Pipeline position:

```
[Raw data / existing docs / user intent]
        ↓
[THIS SKILL: composes a narrative MD]
        ↓ (Markdown)
[narrative-to-slide-outline: produces slide YAML]
        ↓
[pptx skill: produces .pptx]
```

The output must match the input contract of `narrative-to-slide-outline` — that contract is the source of truth, not this file. Before writing your first narrative, read:

- `../narrative-to-slide-outline/SKILL.md` — the Input section defines what your output must satisfy
- `../narrative-to-slide-outline/references/example_narrative.md` — a complete worked example of the target format

## Out of scope

- Producing slide YAML or pptx — downstream skills do that
- Network sources — local files only, never `WebFetch` or remote APIs
- Templated periodic reports (e.g. a fixed monthly KPI deck) — those are edit-driven on a prior template, not narrative composition

## Output format (quick reference)

The canonical spec is in `../narrative-to-slide-outline/SKILL.md` (Input section). This is a working reference — when in doubt, re-read the upstream spec.

Structure (✓ required, ◯ recommended, △ optional / conditional):

```markdown
# {{Title}}                          ✓ required

Author: ...                          ◯ recommended (the metadata block)
Date: YYYY-MM-DD
Audience: ...
Duration: ... minutes

## Executive Summary                 ◯ recommended for executive/business decks;
                                       skippable for short talks, tutorials, case-studies
...

## {{Section}}                       ✓ at least one body section required

### {{Subsection}}                   △ optional; use only when a section
                                       naturally splits into sub-topics

Prose framing.

| Header | Header |                   ◯ inline table whenever the section has chartable numbers
| ------ | -----: |
| ...    | ...    |

(Source: ./path/to/source)           ✓ required whenever data is shown / a factual claim is made

Prose interpretation.

## Conclusion                        ◯ recommended

### Key Takeaways                    ◯ recommended (3-5 bullets)
- ...

### Anticipated Q&A                  △ include only if the user wants it (ask in Step 3);
                                       common for board/executive decks, often skipped
                                       for status updates, tutorials, short pitches
- *Question?* Answer.
```

Source breadcrumb syntax — these are the verification handles the downstream QA step uses. Get the locator wrong and QA cannot verify the claim:

| Type | Format | Notes |
|---|---|---|
| CSV | `(Source: ./data/foo.csv)` | |
| Excel | `(Source: ./data/foo.xlsx, sheet: SheetName)` | `sheet:` required |
| PDF | `(Source: ./reports/x.pdf, page: 7)` | `page:` **required** |
| PPTX | `(Source: ./decks/y.pptx, slide: 3)` | `slide:` **required** |
| Image | `![caption](./images/foo.jpg)` or `(Image: ./images/foo.jpg)` | Markdown image syntax preferred |

The same `(Source: ...)` syntax may be attached **inline to a prose sentence** to cite a qualitative claim that doesn't render its own table — e.g. `... 2x faster than competitors (Source: ./data/market_intel.csv).`

## The Source-attaches-to-claim rule

Every numeric or factual claim should be in one of three states. There is no fourth.

1. **Verified** — supporting data exists locally **within the user-specified scope**. Attach a Source breadcrumb (to the table that contains the number, or inline if the claim is qualitative). **Actively hunt for this state** before falling through to the next two: scan the directories and files the user explicitly pointed at, looking for items whose name, sheet name, or column names plausibly support the claim. A 30-second look that finds the supporting CSV converts an un-cited prose claim into a verifiable sourced table — that's almost always worth doing. Do not reach outside the user-specified scope.
2. **Asserted-without-source** — the user said it, and an active search did not turn up a file that backs it. Keep the prose with no Source. In Step 3 ask the user *where* that data lives (this is usually more productive than asking *whether* to cite it).
3. **Inferred-by-you** — you suspect it from context but the data doesn't directly say it. Mark the claim inline with a placeholder, e.g. `Q3 growth was led by APAC [needs-verification]`. **Never invent a Source path.**

The default failure mode for AI-written narratives is fabricating numbers or sources to sound convincing. This rule exists to make that failure visible instead of silent.

## Workflow

The clarification you can usefully do depends on what you've seen. Asking up front (before any file inspection) yields generic answers; asking with an inventory in hand yields specific, productive ones. So the workflow gathers high-level intent, scans the file and folder *names* (without opening anything), then has a short consultative dialogue using that inventory before doing any content reading.

### Step 1: Capture initial intent + scope

Just two things, no more:

1. **Rough goal** — what kind of narrative are they after? "H1 sales review + strategy", "customer case study for Y Corp", "an exploration of risks in this data", etc.
2. **Source scope** — folder path(s) or file path(s).

If the skill was invoked with no context (just `/compose-slide-narrative`), ask: *"What kind of slide narrative do you want to build, and where is the source material?"*

If only one of the two is missing, ask just for that one. Detailed scoping (story angle, audience, which files matter) is what Step 3 is for — don't try to extract it all here.

**Hard rule**: never autonomously scan directories the user did not point at, even ones that look obviously useful like `./data/` next to the working directory.

### Step 2: Inventory — names and structure only

Walk the user-specified scope and capture:

- File names
- Folder hierarchy
- File sizes
- File types (by extension)

Do **not** open any file. No `read_csv`, no `read_excel`, no `pdfplumber`, not even Excel sheet listing. The point of this step is to know **what exists**, not what's inside. This is cheap — even a folder with 300 files yields just a list of names.

Use `ls -R`, `find`, or a brief Python listing — whichever fits. Keep it under 30 seconds.

Form a mental map. Example: *"Data/ has /sales (3 CSVs broken down by quarter), /marketing (1 promotion-cost Excel + 2 PDFs), /hr (1 annual report PDF). The names suggest sales is the main pillar; the promotion-cost file could feed a cost-effectiveness angle if the user wants one."*

If the user pointed at a single file rather than a folder, this step is trivial — just note the filename and type.

Excel (`.xlsx`) and PowerPoint (`.pptx`) are zip-format under the hood, but you do **not** unzip them here. Their inventory entry is just the filename + size. Sheet names and slide titles come later, in Step 4, via `openpyxl` / `python-pptx`.

### Step 3: Consultative scoping dialogue

Now that you have the inventory in your head, talk to the user. The goal is to lock down four things before opening any file:

1. **Story angle** — what's the main thread of the narrative?
2. **Which files are in scope** — out of the inventory, which ones should actually feed the story?
3. **Audience and duration** — who's it for, how long? Plus tone if it's not obvious from context.
4. **Anticipated Q&A** — include the closing Q&A section or not? Common for board/executive decks, often skipped for status updates, tutorials, or short pitches.

Use the inventory to make your questions specific and grounded. Bad: *"What kind of analysis do you want?"* Good: *"You mentioned an H1 sales review plus strategy. I see q1_sales.csv, q2_sales.csv, and a promotion_cost.xlsx in there. Three angles I could take: (a) just analyze the sales trend; (b) lean on the strategy/recommendation side; (c) include promotion-cost ROI as a third pillar. Which fits what you have in mind?"*

**Style of the dialogue**:
- Plain prose for open-ended questions; `AskUserQuestion` only when there's a clean set of discrete options
- 1–3 rounds typically. Each round, factor in what the user just said and refine your next question. If you're past round 3, you're likely interrogating — wrap up
- When scope feels locked, **summarize back and get explicit confirmation** before moving on: *"OK, so the plan is: H1 sales review with a cost-effectiveness angle, using q1/q2 sales and promotion_cost.xlsx, for the leadership team in 20 min, with a Q&A section. Sound right?"*

If the user's first message was already specific enough that all four items are clear, you may skip the back-and-forth and go straight to Step 4 — but still send a one-line confirmation of the plan first.

### Step 4: Deep exploration

Scope is now locked. Open the in-scope files and read enough to support the narrative you're about to write. Out-of-scope files are not touched.

Use `/opt/uv-venv/bin/python`. `pandas`, `openpyxl`, `pdfplumber`, `python-pptx`, `markitdown` are all importable. If unsure whether a package is available, check `/workspaces/cc-dev-container/.devcontainer/Dockerfile`.

For each in-scope file:

- **CSV** — head, shape, column names + dtypes. If a specific metric is needed for the narrative, compute it (sum, mean, group-by) here so the number lands in the draft already correct.
- **Excel** — list sheet names, then head/shape per in-scope sheet. Pandas/openpyxl reads `.xlsx` directly — do not unzip.
- **PDF** — page count + first ~500 chars per page (or just the first 3 pages if many). Use `pdfplumber`; fall back to `pdftotext` or `markitdown` for scanned PDFs.
- **PPTX** — slide titles and text via `python-pptx`. Reads `.pptx` directly — do not unzip.
- **Markdown / text** — Read in full.
- **Images** — note path + filename only; do not OCR unless asked.

If during reading you discover the data doesn't support the angle agreed in Step 3 (a CSV is empty, the metric you planned to chart isn't there, etc.), flag it to the user and re-negotiate — don't silently pivot.

Never run anything against remote endpoints. `WebFetch` is out of scope for this skill.

### Step 5: Draft the narrative

Produce the full first draft in one pass. Don't write section-by-section asking for confirmation — that wastes turns. Get a complete draft on disk, then iterate.

Composition rules:

- **One claim, one source.** Every numeric statement either sits next to a table with a Source breadcrumb, has an inline `(Source: ...)` citation, or carries a `[needs-verification]` marker. There is no fourth option.
- **Tables are the primary carrier of numbers.** If you mention "Q2 revenue was $187M" in prose, also place the table that contains 187. Don't put numbers only in prose — the downstream YAML/pptx step builds charts from tables, not from prose.
- **Don't fabricate.** Missing numbers → use a placeholder like `$XX M` and flag in Step 6. Missing source paths → leave no Source rather than invent one.
- **Respect the source author when re-formatting an existing document.** Lift structure and claims from the source; compress and reframe for the audience, but don't rewrite the analysis.
- **Closing block**: always include a Conclusion section and Key Takeaways (3-5 bullets). Include an Anticipated Q&A section (3-5 questions with brief answers) only if the user said they want it in Step 3.
- **One slide ≠ one section.** This is a *narrative*, not a deck outline. Let the downstream skill decide slide breaks. Write in coherent prose with embedded tables.

Write the draft (Write tool) to the agreed output path (default `./narrative.md`).

### Step 6: Report and iterate

After writing the draft, summarize back to the user:

- Output path
- Section count and rough length (lines or words)
- Sources cited — how many distinct files referenced
- **Un-cited claims** — list each prose statement that has no Source. The user decides: add evidence, accept as-is, or drop.
- **`[needs-verification]` markers** — list each with the surrounding sentence
- Open question: *"Anything to refine?"*

If yes, enter the revision loop:

- Accept one revision instruction (or a small batch) per turn
- Apply with the **Edit tool, not Write** — preserves breadcrumbs, ordering, and formatting
- One-sentence confirmation of what changed
- For a new claim that needs evidence: check what you already read in Step 4 first, then ask the user where the data is. Never silently invent a Source.
- Repeat until the user signals done ("OK", "looks good", "ship it")

**Editing an existing narrative.md in a new conversation**:
- Ask for the narrative path (required)
- Ask if the original data sources are still accessible (optional — only needed if revisions add new sourced claims)
- Skip Steps 1–5; come straight here

**Exit**: re-run the Step 6 report on the updated file (refreshed lists of citations / un-cited claims / `[needs-verification]` markers), then stop.

## Principles

- **Source rigor over speed.** A fabricated number that sounds plausible is worse than no number. The `[needs-verification]` marker is your friend.
- **Local files only.** No `WebFetch`, no remote APIs. The working directory is the universe.
- **Numbers belong in tables, interpretation belongs in prose.** The downstream pptx skill builds charts from the tables; prose narrates and frames.
- **Write for the speaker, not the slide.** The narrative captures the speaker's argument. `narrative-to-slide-outline` decides how it lands on slides.
- **First draft wide, then iterate narrow.** Get a complete draft on disk in Step 5, then refine in Step 6. Don't half-finish.
