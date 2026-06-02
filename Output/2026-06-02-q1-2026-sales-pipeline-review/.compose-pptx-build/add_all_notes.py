"""Batch-add speaker notes to all slides that have them."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

YAML_PATH = Path("/workspaces/cc-dev-container/Output/2026-06-02-q1-2026-sales-pipeline-review/slide-outline.yaml")
UNPACKED = Path("/workspaces/cc-dev-container/Output/2026-06-02-q1-2026-sales-pipeline-review/.compose-pptx-build/unpacked")
SCRIPTS_DIR = Path("/workspaces/cc-dev-container/.claude/skills/compose-pptx/scripts")

# yaml_index 0 -> slide21.xml, etc.
SLIDE_MAP = {i: f"slide{21+i}.xml" for i in range(15)}

with open(YAML_PATH) as f:
    doc = yaml.safe_load(f)

slides = doc.get("slides", [])

for yaml_idx, slide in enumerate(slides):
    has_notes = any([
        slide.get("speaker_notes"),
        slide.get("prose_sources"),
        slide.get("data"),
    ])
    if not has_notes:
        continue

    slide_file = SLIDE_MAP[yaml_idx]
    entry = {k: v for k, v in slide.items() if k in ("speaker_notes", "prose_sources", "data")}

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf:
        json.dump(entry, tf, ensure_ascii=False)
        tf_path = tf.name

    result = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "set_notes.py"), str(UNPACKED), slide_file, "--entry-json", tf_path],
        capture_output=True, text=True
    )
    Path(tf_path).unlink(missing_ok=True)

    if result.returncode != 0:
        print(f"ERROR {slide_file}: {result.stderr.strip()}")
    else:
        print(f"OK    {slide_file}: {(result.stdout or result.stderr).strip()}")
