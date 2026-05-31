"""Attach speaker notes to a slide (raw-XML), by cloning a template notes slide.

add_slide.py strips the notes relationship when it duplicates a slide (so two
slides never share one notes part — the same hazard as shared charts). To give a
built slide its own notes, this clones an existing notesSlide from the template
(reusing its notesMaster wiring and body styling), repoints it at this slide,
rewrites the notes body text, and registers it.

If the template contains no notesSlide at all (no notesMaster to hang one on),
it prints a warning and does nothing — notes are skipped for that deck.

Usage:
    python set_notes.py <unpacked_dir> <slideN.xml> --text-file <notes.txt>
"""

import argparse
import re
import shutil
from pathlib import Path

import defusedxml.minidom as minidom

R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def _next_index(d: Path, stem: str, ext: str) -> int:
    nums = [int(m.group(1)) for f in d.glob(f"{stem}*{ext}")
            if (m := re.match(rf"{stem}(\d+){re.escape(ext)}", f.name))]
    return max(nums, default=0) + 1


def _set_body_text(notes_dom, text):
    """Write `text` into the notes body placeholder (ph type='body')."""
    for sp in notes_dom.getElementsByTagName("p:sp"):
        phs = sp.getElementsByTagName("p:ph")
        if not phs or phs[0].getAttribute("type") != "body":
            continue
        txBodies = sp.getElementsByTagName("p:txBody")
        if not txBodies:
            return False
        txBody = txBodies[0]
        # Drop existing paragraphs, keep bodyPr/lstStyle.
        for p in list(txBody.getElementsByTagName("a:p")):
            txBody.removeChild(p)
        a_ns = "http://schemas.openxmlformats.org/drawingml/2006/main"
        for line in (text.split("\n") or [""]):
            p = notes_dom.createElementNS(a_ns, "a:p")
            r = notes_dom.createElementNS(a_ns, "a:r")
            t = notes_dom.createElementNS(a_ns, "a:t")
            t.appendChild(notes_dom.createTextNode(line))
            r.appendChild(t)
            p.appendChild(r)
            txBody.appendChild(p)
        return True
    return False


def main():
    ap = argparse.ArgumentParser(description="Attach speaker notes to a slide.")
    ap.add_argument("unpacked_dir")
    ap.add_argument("slide", help="slide file name, e.g. slide5.xml")
    ap.add_argument("--text-file", required=True, help="file holding the notes text")
    args = ap.parse_args()

    unpacked = Path(args.unpacked_dir)
    notes_text = Path(args.text_file).read_text(encoding="utf-8").rstrip("\n")

    notes_dir = unpacked / "ppt" / "notesSlides"
    samples = sorted(notes_dir.glob("notesSlide*.xml")) if notes_dir.exists() else []
    if not samples:
        print("Warning: template has no notesSlide/notesMaster; speaker notes skipped.")
        return
    sample = samples[0]

    # 1. Clone the sample notes part.
    n = _next_index(notes_dir, "notesSlide", ".xml")
    new_notes = notes_dir / f"notesSlide{n}.xml"
    shutil.copy2(sample, new_notes)

    # 2. Clone + repoint its rels: keep notesMaster, point the slide rel at our slide.
    sample_rels = notes_dir / "_rels" / f"{sample.name}.rels"
    new_rels = notes_dir / "_rels" / f"notesSlide{n}.xml.rels"
    if sample_rels.exists():
        rdom = minidom.parse(str(sample_rels))
        for rel in rdom.getElementsByTagName("Relationship"):
            if rel.getAttribute("Type").endswith("/slide"):
                rel.setAttribute("Target", f"../slides/{args.slide}")
        new_rels.write_bytes(rdom.toxml(encoding="utf-8"))

    # 3. Rewrite the notes body text.
    ndom = minidom.parse(str(new_notes))
    if not _set_body_text(ndom, notes_text):
        print("Warning: no body placeholder in notes sample; notes left as template text.")
    new_notes.write_bytes(ndom.toxml(encoding="utf-8"))

    # 4. Content_Types override.
    ct_path = unpacked / "[Content_Types].xml"
    ct = ct_path.read_text(encoding="utf-8")
    part = f"/ppt/notesSlides/notesSlide{n}.xml"
    if part not in ct:
        ov = (f'<Override PartName="{part}" '
              f'ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>')
        ct = ct.replace("</Types>", f"  {ov}\n</Types>")
        ct_path.write_text(ct, encoding="utf-8")

    # 5. Relate the slide to its new notes part.
    slide_rels = unpacked / "ppt" / "slides" / "_rels" / f"{args.slide}.rels"
    sdom = minidom.parse(str(slide_rels))
    # Remove any stale notesSlide rel first.
    for rel in list(sdom.getElementsByTagName("Relationship")):
        if rel.getAttribute("Type").endswith("/notesSlide"):
            rel.parentNode.removeChild(rel)
    rids = [int(m) for m in re.findall(r'Id="rId(\d+)"', slide_rels.read_text(encoding="utf-8"))]
    rid = f"rId{max(rids, default=0) + 1}"
    rel = sdom.createElement("Relationship")
    rel.setAttribute("Id", rid)
    rel.setAttribute("Type", f"{R_NS}/notesSlide")
    rel.setAttribute("Target", f"../notesSlides/notesSlide{n}.xml")
    sdom.documentElement.appendChild(rel)
    slide_rels.write_bytes(sdom.toxml(encoding="utf-8"))

    print(f"Attached notesSlide{n}.xml to {args.slide} ({len(notes_text)} chars).")


if __name__ == "__main__":
    main()
