# Claude Code 開発テンプレートを Antigravity v2 用に移植するための知識

> このプロジェクトは Claude Code 前提（`.claude/`, `CLAUDE.md`, Skill 群）で作られている。
> これを Google Antigravity v2 でも同じように使うために必要な「フォルダ/ファイル構成・概念の違い」と「移植方針」をまとめる。
>
> ⚠️ 注意: 本ドキュメントはコミュニティ記事と一部公式ドキュメント（Codelabs / antigravity.google/docs）を基にしている。
> Antigravity v2 は更新が速く、UI ラベルやパス仕様が変わっている可能性がある。`.agent`（単数）など実機での確認を推奨。
> 「未検証」と明記した箇所は実機テストで確証を取ること。

---

## 1. 全体像 — 対応表（Claude Code → Antigravity v2）

| 用途 | Claude Code（現状） | Antigravity v2 | 互換性 / 必要作業 |
|---|---|---|---|
| プロジェクト指示書 | `CLAUDE.md` | `AGENTS.md`（クロスツール共有）/ `GEMINI.md`（Antigravity専用・優先度最高） | 中身は流用可。ファイルを用意し直す |
| スキル（ワークスペース） | `.claude/skills/<name>/SKILL.md` | `.agent/skills/<name>/SKILL.md`（**単数 `.agent`**） | `SKILL.md` 形式は共通。フォルダを移す/複製 |
| スキル（グローバル） | `~/.claude/skills/` | `~/.gemini/antigravity/skills/` | — |
| スラッシュ手動起動マクロ | スキルが兼任 | **Workflows**（`/コマンド名`） | 別概念。作り直しが必要 |
| パーミッション / フック | `.claude/settings.json`, `settings.local.json` | リポジトリ内ファイルではなく **IDE Settings** | 移植先なし。IDE 側で再設定 |
| MCP サーバ | `.mcp.json` | Antigravity の MCP 設定 | 再設定が必要 |

---

## 2. プロジェクト指示書（CLAUDE.md / AGENTS.md / GEMINI.md）

### 事実
- **Claude Code がネイティブで読むのは `CLAUDE.md` だけ**（2026年中時点）。`AGENTS.md` は読まない。
  - リポジトリに `AGENTS.md` しか無いと、Claude Code は**プロジェクト指示をゼロ件ロード（エラーも出ない）**。
  - `AGENTS.md` ネイティブ対応は未実装リクエスト（anthropics/claude-code#34235）。
- **Antigravity は `AGENTS.md`（クロスツール共有）と `GEMINI.md`（Antigravity専用・最優先）を読む**。
  - 同じルールが両方にある場合 `GEMINI.md` が優先。

### @-import は「向き」に注意（重要）
- `AGENTS.md` の中に `@CLAUDE.md` と書いても **Claude Code には効かない**（そもそも `AGENTS.md` を開かないため）。
- 正しい向きは逆：**`CLAUDE.md` の中に `@AGENTS.md` と書く** → Claude Code が `CLAUDE.md` を読み、`AGENTS.md` を展開して取り込む。
- `@import` は **Claude Code の機能**。Antigravity が `@import` を解釈するかは**未検証**。Antigravity には `AGENTS.md` の実体を直接読ませる前提が安全。

### 推奨構成（単一ソース化）
実体を `AGENTS.md` に置き、`CLAUDE.md` は1行だけにする。

```markdown
# CLAUDE.md（中身はこれだけ）
@AGENTS.md
```

```markdown
# AGENTS.md（実際の指示は全部ここに書く）
## 1. 事実確認とツール利用
...
```

- Claude Code: `CLAUDE.md` → `@AGENTS.md` 展開で読む ✅
- Antigravity: `AGENTS.md` を直接読む ✅
- Antigravity 固有の挙動だけ `GEMINI.md` に分離する。

### このプロジェクト固有の注意
- 現状ファイル名が **`Claude.md`（C だけ大文字）**。Claude Code が読むのは **`CLAUDE.md`（全大文字）**。
  → 現状このファイルは Claude Code に読まれていない可能性が高い。**まず `CLAUDE.md` にリネームすべき**。

---

## 3. スキルとワークフロー（3層モデル）

Antigravity は機能が3層に分かれる。Claude Code はスキルが自動発火と手動 `/` 起動を兼ねるが、Antigravity は分離している。

| 種類 | 起動方法 | 置き場所 | 構造 |
|---|---|---|---|
| **Rules**（`AGENTS.md`/`GEMINI.md`） | 常時自動 | プロジェクトルート | 1ファイル |
| **Skills**（`SKILL.md`） | エージェントが `description` を見て**自動発火**。プロンプトでスキル名を書けば強制発火も可 | `.agent/skills/<name>/` | フォルダ + `SKILL.md` + 付属物(scripts/ references/ assets/) |
| **Workflows** | **`/コマンド名` で手動起動**（チャットで `/` を打つと一覧表示） | `.agent/workflows/` | **1つの `.md` ファイル**（フォルダ不可） |

### ポイント
- **Skill 自体は `/スキル名` で直接は呼べない**。`/` で呼びたいなら Skill を起動する **Workflow をエイリアスとして作る**のが正規手段。
- 「以前スラッシュで呼べた」のは (a) それが Workflow だった、または (b) プロンプトにスキル名を書いて強制発火させた、のいずれか。

---

## 4. SKILL.md の互換性

### Agent Skills オープン標準の frontmatter フィールド
（agentskills.io。Claude Code / Codex / Cursor / Copilot 等が準拠）

| フィールド | 区分 |
|---|---|
| `name` | 必須（フォルダ名と一致、小文字ハイフン、1-64字） |
| `description` | 必須（発火トリガー。最重要） |
| `license` | 任意 |
| `compatibility` | 任意（環境要件、最大500字） |
| `metadata` | 任意（author/version 等の任意key-value） |
| `allowed-tools` | 任意（実験的） |

→ `name` と `description` は Claude Code / Antigravity 共通。**フォルダを `.agent/skills/` に移すだけで認識される可能性が高い**。
ただし中身が Claude Code 固有ツール（例: `AskUserQuestion`）に依存していると、Antigravity 側に対応ツールが無く動かない恐れがある。

---

## 5. 自動発火を止めて「スラッシュ専用」にしたい場合

### `disable-model-invocation: true` の正体
- これは **Agent Skills オープン標準には含まれない、Claude Code 独自の拡張フィールド**。
  - 標準フィールドは `name` / `description` / `license` / `compatibility` / `metadata` / `allowed-tools` のみ。
- 標準の建付け上「**知らないエージェントは無視してスキルをそのまま実行**」する位置づけ。

### 結果
| やり方 | Claude Code | Antigravity |
|---|---|---|
| `disable-model-invocation: true` | 設計意図は「自動発火を止め `/skillname` のみ」。ただし **active なバグ多数**（#26251 スラッシュで呼べない / #43875 一覧から消える / #19729 先頭でないと見えない / #22345 plugin で効かない） | **未サポートの可能性大。書いても無視され通常通り自動発火する恐れ**。公式記載なし＝未検証 |
| **Workflow（`.agent/workflows/*.md`）** | — | **公式に用意された「スラッシュ専用」の正規手段** ✅ |

### 結論
- **Claude Code** で手動限定にしたい → `disable-model-invocation: true`（バグ留意）。
- **Antigravity** で確実に手動限定にしたい → このフィールドに頼らず **Workflow にする**。

---

## 6. Workflow の仕様

### ファイル形式
- `.agent/workflows/` に置く **`.md` ファイル**（フォルダ不可）。
- YAML frontmatter（`description` 必須）＋ markdown のステップ列。

```markdown
---
description: narrative.md から HTML スライドデッキを生成する
---
1. 入力ファイル narrative.md を読む
2. アウトラインを生成する
3. HTML スライドを出力する
```

### コマンド自動実行の制御
- ステップ直前に **`// turbo`** → そのコマンドだけ自動実行。
- どこかに **`// turbo-all`** → `run_command` を伴う全ステップを自動実行。

### サブエージェントは必須ではない
- Workflow は**メインエージェントが手順を順に実行するだけ**。サブエージェント起動は必須ではない。
- サブエージェント（例: browser subagent）は別概念で、ステップで明示的に委譲した時だけ動く。

---

## 7. ターミナル実行（bash / python）の許可設定

Antigravity でも Gemini は bash / `python ...` を実行できる。ブロックされてはおらず、**Terminal Execution Policy** で承認レベルを制御する。

| モード | 挙動 | Claude Code の対応物 |
|---|---|---|
| **Off (Allow List Only)** | Allow リスト以外は毎回承認 | デフォルトの都度承認 |
| **Auto（デフォルト）** | 安全分類器が安全と判断したコマンド（`ls`, `cat`, `npm test` 等）は自動実行 | `acceptEdits` 寄り |
| **Turbo (Deny List Only)** | Deny リスト以外は全部自動実行 | bypass / `--dangerously-skip-permissions` |

### 設定場所
- **Settings → Antigravity → Terminal Execution Policy**、または設定検索で `terminal.autoExecution`（"Always proceed" / "Request review"）。
- 特定コマンドだけ許可 → Allow List に `python`, `python3`, `pytest`, `uv run` 等を追加。
- 特定コマンドだけ禁止 → Deny List に `rm`, `git push` 等を追加。
- CLI 版には `--dangerously-skip-permissions` フラグも存在（非推奨）。

### 推奨
- Claude Code 風の「だいたい自動・危険なものは止まる」運用 → **Auto + Allow List に `python` 系追加**。
- フルオート → **Turbo + Deny List で破壊的コマンドだけ禁止**（`rm -rf` 等は止まらないので Deny List 整備必須）。

---

## 8. このプロジェクトで実際にやるべき変更（チェックリスト）

> ※フォルダ削除は避け、`.claude` と `.agent` の**両対応（複製）**にしておくのが安全。

- [ ] `Claude.md` → **`CLAUDE.md`** にリネーム（Claude Code に読ませる）。
- [ ] 指示の実体を **`AGENTS.md`** に集約し、`CLAUDE.md` は `@AGENTS.md` の1行にする（単一ソース化）。
- [ ] Antigravity 固有挙動があれば **`GEMINI.md`** に分離。
- [ ] `.claude/skills/<name>/SKILL.md` を **`.agent/skills/<name>/`** にも配置（`SKILL.md` 形式は流用可）。
- [ ] SKILL.md 内の Claude Code 固有ツール依存（`AskUserQuestion` 等）を洗い出し、Antigravity 用に代替を検討。
- [ ] **自動発火させず `/` 専用にしたいスキル** → `.agent/workflows/<名前>.md` として Workflow に書き直す（`disable-model-invocation` には頼らない）。
- [ ] `settings.json` / `.mcp.json` の内容を **Antigravity の IDE Settings / MCP 設定**で再設定（Terminal Execution Policy 含む）。

---

## 9. 未検証・要実機確認の項目

- `.agent`（単数）が v2 でも正か（コミュニティ記事に `.agents` 複数形の誤記が多い）。
- Antigravity が `@import` を解釈するか。
- Antigravity が `disable-model-invocation` を解釈するか（おそらく無視）。
- Workflows の正確なディレクトリ（`.agent/workflows/` で確認できているが v2 での変更有無）。
- 既存 Skill が Antigravity 上でそのまま発火するか（特にツール依存箇所）。

---

### 参考リンク
- Authoring Google Antigravity Skills — Codelabs: https://codelabs.developers.google.com/getting-started-with-antigravity-skills
- Google Antigravity — Rules & Workflows: https://antigravity.google/docs/rules-workflows
- Specification — Agent Skills (agentskills.io): https://agentskills.io/specification
- CLAUDE.md vs AGENTS.md in 2026: https://bestagent.dev/claude-md-vs-agents-md-2026/
- disable-model-invocation 関連 issue: https://github.com/anthropics/claude-code/issues/26251
