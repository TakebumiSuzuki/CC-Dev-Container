---
name: slide-content-planner
description: "Use this skill when the user wants to create, plan, or draft the content of a presentation, slide deck, or any set of slides — even if they haven't specified the final format yet. Trigger when the user mentions 'スライド', 'プレゼン', 'slide', 'presentation', 'deck', 'slide deck', 'プレゼン資料', '発表資料', or asks to 'plan slides', 'outline a presentation', 'draft slide content', 'スライドの構成', 'スライドのストーリー' or similar. This skill guides the user through a structured co-authoring workflow that reads local source files, conducts web research via sub-agents when needed, builds a narrative, and produces a Markdown file where each section corresponds to one slide with its content description. Use this skill proactively even if the user just says something like 'スライドを作りたい' or 'プレゼンの資料を考えたい'."
---

# Slide Content Planner

This skill co-authors presentation content with the user through structured dialogue. The output is a **Markdown file where each section represents one slide**, describing what to put on it — not the final PPTX itself. That conversion is handled by a separate skill.

Work in the user's language throughout.

---

## Phase 0: Starting Point

If topic and/or source are not yet known, ask both in one message:
> 「スライドを一緒に作っていきましょう。まず2点確認させてください。
>
> ① 何についてのスライドを作りたいですか？（テーマ、目的、発表の場など）
>
> ② 情報源はどうしますか？
> 　A. ローカルのファイル・ディレクトリのみ
> 　B. ウェブ検索のみ
> 　C. ローカルファイルとウェブ検索を組み合わせる
>
> 外部情報を使いたくない場合は A をお選びください。途中変更も可能です。」

If topic is already known but source is not (or vice versa), ask only the missing part.

Record the user's choice as **source mode** (local-only / web-only / both) and carry it through all phases — never use web search if the user chose local-only.

If both topic and source are already known from context, skip straight to Phase 1.

---

## Phase 1: Information Collection

### 1-1. Read source files and initial web search

**If source mode includes local files:**
- List files in the directory, read the ones that seem relevant (documents, data, reports, notes)
- Summarize what you've learned and what gaps remain

**If source mode includes web search (web-only or both):**
- Spawn a **sub-agent** at this point to do a rough initial web search on the topic — the goal is breadth, not depth. Collect background information, key statistics, and relevant context.
- Incorporate the results into your understanding before moving on.

After collecting from all applicable sources, give the user a brief summary of what you've found so far.

### 1-2. Understand the goal through dialogue

Ask the following (can be combined into one message):
1. 聴衆は誰ですか？（例：経営層、エンジニア、顧客、一般向け）
2. 聴衆にどうなってほしいですか？（理解してほしいこと、取ってほしい行動など）
3. 何枚くらいのスライドを想定していますか？（未定でも大丈夫です）

Let the user answer freely — shorthand, bullet points, or stream-of-consciousness is fine.

### 1-3. Supplement with additional sources

If local files are insufficient or seem incomplete:
1. **First, re-search the local filesystem yourself.** Look for files and folders that might have been missed — try related directory names, alternate file extensions, subdirectories, or files that weren't initially obvious. Only move on if the re-search still leaves meaningful gaps.
2. Then ask: 「他に参考にできるファイルやデータはありますか？（過去資料、データファイル、メモなど）」
3. If the user has nothing to add, then ask: 「ウェブ検索で補足情報を集めますか？たとえば市場データや競合情報など、役立ちそうな情報が見つかるかもしれません。」
4. If yes to web search: spawn a **sub-agent** to search for the relevant information. Wait for results and incorporate them.

Do not search without the user's agreement.

### 1-4. Clarifying questions

After initial info gathering, generate **3–5 numbered clarifying questions** based on the most important gaps. Focus especially on parts where the logic or claims feel weak or under-supported.

For each area where the argument seems thin:
- Ask if there is supplementary data available that could strengthen it
- If source mode allows web search, ask whether the user wants to do a targeted web search to find supporting evidence

Tell the user they can answer in shorthand (e.g., "1: yes, 2: see the PDF, 3: not needed").

**If collected data contradicts the user's stated goals:**
Before asking clarifying questions, flag the contradiction explicitly. For example:
> 「収集したデータでは〇〇という結果が出ていますが、ご希望のスライド内容は△△という結論を示そうとしています。この点に矛盾があるように見えます。どのように扱いますか？（データに合わせて結論を修正する／データの解釈を変える／この点には触れない、など）」

Do not silently paper over contradictions — surface them so the user can decide.

Repeat dialogue until you have enough to build a coherent story.

---

## Phase 2: Story Construction

Build the overall narrative arc of the presentation.

### 2-1. Propose a story structure

Based on the collected information, propose a narrative structure. Common patterns:
- **Problem → Root Cause → Solution → Result** (for proposals/pitches)
- **Context → Findings → Recommendations** (for reports)
- **Background → Current State → Issues → Next Steps** (for status updates)
- **Overview → Deep Dive → Q&A** (for educational/technical talks)

Present the proposed structure and ask if it fits, or if the user wants to adjust it.

### 2-2. Confirm the core message

Based on everything gathered so far, propose a core message in one sentence and confirm with the user:
> 「このプレゼンのコアメッセージは『〇〇』でよいですか？」

If the user is unsure or says the message doesn't quite fit, propose 2–3 alternative formulations based on the collected information and ask which feels closest. Don't wait for the user to come up with it themselves — always lead with a concrete proposal.

Don't proceed until a core message is agreed on — everything else flows from here.

### 2-3. Save the narrative and confirm output directory

Once the story structure and core message are confirmed, ask the user where to save all output files. This applies to both `narrative.md` (saved now) and `slides-draft.md` (saved in Phase 4):
> 「ここからいくつかのファイルを保存していきます。保存先のディレクトリを教えてください。指定がなければプロジェクトのトップ階層に保存します。（このディレクトリを `narrative.md` と `slides-draft.md` の両方に使います）」

Record this as **output directory** and use it for all subsequent file saves without asking again.

Before saving, check whether `narrative.md` already exists at the output directory. If it does, ask:
> 「すでに `narrative.md` が存在します。上書きしてよいですか？」
Only overwrite if the user confirms.

Save `narrative.md` at the output directory. The file should contain:
- The agreed story structure (narrative arc and section breakdown)
- The confirmed core message
- A brief summary of key information gathered from sources

---

## Phase 3: Slide Design

Now that the story is settled, work out the slide-level design decisions in a single integrated conversation. Cover all three dimensions — page count, density, and visuals — together, because they affect each other.

### 3-1. Integrated slide design discussion

**Step 1 — Discuss information density** and ask the user which style fits:
- **シンプル**: 1スライド1メッセージ、テキスト少なめ、ビジュアル中心
- **バランス型**: 数ポイント＋裏付けデータ
- **情報密度高め**: テキストやデータ多め（社内レポートなど）

**Step 2 — Go through the story structure and identify which content areas would benefit from a visual.** Reference the topic or theme of each area, not a slide number (slide numbers aren't assigned yet). For each candidate, ask:
- どのような種類のビジュアルが適切か（グラフ / 表 / 図解・ダイアグラム / 写真・イラスト）
- そのパートで何を伝えるためのビジュアルか

For example: 「売上推移の部分では折れ線グラフを入れると効果的そうですが、いかがですか？」 — refer to the topic, never to a slide number.

**Once a visual is agreed on, immediately extract the underlying data from the source files** (or from web search results if applicable). Record:
- 実際の数値・データ（Markdownテーブル形式で）
- データの出所（ファイル名・シート名・行列、またはURL）

For large datasets (more than ~20 rows), include a representative excerpt in the MD and note the full file reference. Never leave a visual agreed without capturing its data — a visual description without data cannot be used by the PPTX generation skill.

**Step 3 — Estimate total slide count** based on the story structure, chosen density style, and visual placements agreed above. If the user gave a preferred count in Phase 1-2, reference it here and flag any tension:
> 「先ほど〇〇枚ご希望とのことでしたが、この内容とビジュアル構成だと大体△△枚になりそうです。1枚あたりの情報量がかなり多くなりますが、よろしいですか？それとも枚数を増やしますか？」

If the user gave no preference, just share the estimate:
> 「この構成だと大体〇〇枚になる見込みです。この枚数で進めてよいですか？」

Resolve any mismatch before moving to Phase 4.

---

## Phase 4: Markdown Output

Once slide count, structure, density, and visual decisions are agreed on, generate the output MD file.

### Output format

Before saving, check whether `slides-draft.md` already exists at the output directory. If it does, ask:
> 「すでに `slides-draft.md` が存在します。上書きしてよいですか？」
Only overwrite if the user confirms.

Save as `slides-draft.md` at the output directory confirmed in Phase 2-3.

Each slide gets a section like this:

```markdown
## Slide N: [Title]

**Type**: [Opening / Content / Data / Summary / etc.]
**Core message**: [One sentence — what the audience should take away from this slide]

### Content
[Bullet points or prose describing what goes on this slide. Be specific enough that someone else could write the slide copy from this description alone.]

### Visual
**Type**: [グラフ（棒・折れ線・円等） / 表 / 図解・ダイアグラム / 写真・イラスト / None]
**Purpose**: [このビジュアルで何を伝えるか — 1文で]
**Data**:
[ビジュアルが None でない場合は必須。データをMarkdownテーブルで記載。
例：
| 年度 | 売上（万円） |
|------|------------|
| 2022 | 1,200 |
| 2023 | 1,450 |
| 2024 | 1,680 |
データが大きい場合は代表的な抜粋を記載し、Source で全体の参照先を示す。]
**Source**: [ファイル名・シート名・行列範囲、またはURL。ローカルファイルの場合は相対パスで記載。Noneの場合は省略可。]

### Speaker notes
[Required. Write clear, concrete talking points — not vague placeholders. Include:
- What to say when this slide appears (key message in spoken language)
- Transitions to the next slide where relevant
- Any data, statistics, or facts shown in the Visual, with their source (file name, URL, or document reference)
- Citations or quotations used on this slide, with full attribution]
```

Create a section for every slide, including the title slide, section dividers, and closing slide.

---

## Phase 5: Validation

After generating the MD, perform three checks before declaring the output done. **Check 1 and Check 3** are delegated to a sub-agent (no prior conversation context — acts as an independent reviewer). **Check 2** is performed by the main agent using the agreed requirements from earlier phases.

### Check 1: Story flow (sub-agent)

Spawn a sub-agent with the full MD content. Instruct it to:
- List all slide titles and their core messages in a compact table
- Review for: gaps in logic, contradictions, abrupt jumps, weak transitions
- Report any issues found with proposed fixes

### Check 2: User requirements match (main agent)

Using the agreements reached in Phases 1–3, verify:
- Total slide count matches what was agreed
- Information density per slide matches the agreed style
- All agreed visuals (graphs, tables, diagrams) are specified in the correct content areas
- The core message confirmed in Phase 2 is clearly reflected in the closing slide(s)

Flag any mismatches.

### Check 3: General slide validity (sub-agent)

Spawn a sub-agent with the full MD content. Instruct it to check against common presentation principles:
- Each slide has exactly one core message (not two competing ideas)
- Opening slide sets up the story clearly (why we're here, what we'll cover)
- Closing slide lands the core message and provides a clear next step or call to action
- No two adjacent slides feel redundant

### Validation result

If issues are found: list them, propose fixes, update the MD, and re-run only the affected checks.

**Maximum 3 validation rounds.** If issues remain after 3 rounds, present the outstanding items to the user and ask how to proceed rather than continuing to iterate automatically.

If all checks pass: announce the MD is finalized and tell the user:
> 「`slides-draft.md` が完成しました。次のステップとして、これをもとに pptx スキルで実際のスライドファイルを生成できます。」

---

## Tips

**Stay grounded in the source material.** Don't invent facts. If something is uncertain, flag it in the speaker notes as "要確認".

**One decision at a time.** Don't rush the user through all phases at once. Each phase should feel like a natural conversation, not a questionnaire.

**Adapt to the user's pace.** If the user already has a clear story in mind, you can move faster through Phases 1–2. If they're exploring, spend more time there.

**Sub-agents for web search and independent validation.** Spawn sub-agents for: (1) initial web search in Phase 1-1 when source mode includes web, (2) supplemental web search in Phase 1-3 if the user agrees, (3) Check 1 and Check 3 in Phase 5. Check 2 (requirements match) is always done by the main agent. Don't spawn for anything else.

**Never output the final PPTX.** This skill produces only the MD content plan. Converting to PPTX is a separate step.
