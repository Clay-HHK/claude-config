"""Add an arXiv paper to a Zotero collection using linked_file mode.

The PDF is stored locally under <root>/<kind>/<Surname><Year>_<Slug>.pdf, and
Zotero gets a linked_file attachment pointing to that absolute path. No cloud
storage is consumed; works on full free-tier Zotero accounts.

Usage:
    uv run --with pyzotero --with python-dotenv python add_paper.py \
        --env /path/to/project/.env \
        --root /path/to/project/related_work \
        --arxiv 2404.16789 \
        --collection-key V8T4CCEE \
        --kind surveys \
        --tags survey "continual learning"

If you prefer to look up the collection by path instead of key, also pass:
    --collections-mapping /path/to/project/.zotero_collections.json \
    --collection-path "CL_LLM/Surveys"
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.request import urlopen

try:
    from dotenv import load_dotenv
    from pyzotero import zotero
except ImportError:
    sys.exit("Run inside an env with pyzotero + python-dotenv installed, e.g. "
             "uv run --with pyzotero --with python-dotenv python ...")

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}


def fetch_arxiv_metadata(arxiv_id: str) -> dict:
    url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}"
    with urlopen(url, timeout=30) as r:
        xml = r.read()
    root = ET.fromstring(xml)
    entry = root.find("atom:entry", NS)
    if entry is None:
        sys.exit(f"arXiv {arxiv_id} not found")

    def text(tag: str) -> str:
        el = entry.find(tag, NS)
        return (el.text or "").strip() if el is not None else ""

    authors = [
        (a.find("atom:name", NS).text or "").strip()
        for a in entry.findall("atom:author", NS)
    ]
    pdf_url = ""
    for link in entry.findall("atom:link", NS):
        if link.attrib.get("title") == "pdf":
            pdf_url = link.attrib.get("href", "")

    return {
        "arxiv_id": arxiv_id,
        "title": " ".join(text("atom:title").split()),
        "abstract": " ".join(text("atom:summary").split()),
        "date": text("atom:updated")[:10],
        "authors": authors,
        "pdf_url": pdf_url,
    }


def safe_filename(first_author: str, year: str, title: str) -> str:
    surname = first_author.split()[-1] if first_author else "Unknown"
    slug = re.sub(r"[^A-Za-z0-9]+", "_", title)[:50].strip("_")
    return f"{surname}{year}_{slug}.pdf"


def split_name(full: str) -> tuple[str, str]:
    parts = full.split()
    if len(parts) == 1:
        return ("", parts[0])
    return (" ".join(parts[:-1]), parts[-1])


def resolve_collection_key(args) -> str:
    if args.collection_key:
        return args.collection_key
    if not (args.collections_mapping and args.collection_path):
        sys.exit("Provide either --collection-key OR "
                 "(--collections-mapping AND --collection-path).")
    mapping = json.loads(Path(args.collections_mapping).read_text())
    key = mapping.get(args.collection_path)
    if not key:
        sys.exit(f"Collection path not found in mapping: {args.collection_path}")
    return key


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True, help="Path to .env with ZOTERO_* vars")
    ap.add_argument("--root", required=True,
                    help="Project root for local PDFs (e.g. /path/to/related_work)")
    ap.add_argument("--arxiv", required=True, help="arXiv id, e.g. 2404.16789")
    ap.add_argument("--kind", default="papers",
                    help="Subdir under --root for the PDF (e.g. surveys / papers)")
    ap.add_argument("--collection-key", help="Zotero collection key (preferred)")
    ap.add_argument("--collections-mapping",
                    help="Optional path JSON {path -> key} written by setup_collections.py")
    ap.add_argument("--collection-path",
                    help="Slash-path like 'CL_LLM/Surveys' (requires --collections-mapping)")
    ap.add_argument("--tags", nargs="*", default=[])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    load_dotenv(args.env)
    meta = fetch_arxiv_metadata(args.arxiv)
    year = meta["date"][:4] or "0000"
    first_author = meta["authors"][0] if meta["authors"] else "Unknown"
    pdf_name = safe_filename(first_author, year, meta["title"])
    pdf_path = (Path(args.root) / args.kind / pdf_name).resolve()

    print(f"arXiv:   {args.arxiv}")
    print(f"Title:   {meta['title']}")
    print(f"Authors: {', '.join(meta['authors'])}")
    print(f"PDF:     {pdf_path}")
    print(f"Tags:    {args.tags}")
    if args.dry_run:
        return

    zot = zotero.Zotero(
        library_id=os.environ["ZOTERO_LIBRARY_ID"],
        library_type=os.environ["ZOTERO_LIBRARY_TYPE"],
        api_key=os.environ["ZOTERO_API_KEY"],
    )
    coll_key = resolve_collection_key(args)
    print(f"Collection key: {coll_key}")

    # Duplicate guard on the parent item (by exact title)
    hits = zot.items(q=meta["title"], qmode="titleCreatorYear", limit=10)
    item_key = next(
        (h["key"] for h in hits if h["data"].get("title", "").strip() == meta["title"]),
        None,
    )

    # If the item already has a linked PDF, skip everything (no download, no item edit).
    if item_key:
        print(f"Item already in library: {item_key}")
        existing_linked_pdfs = [
            c for c in zot.children(item_key)
            if c["data"].get("linkMode") == "linked_file"
            and c["data"].get("contentType") == "application/pdf"
        ]
        if existing_linked_pdfs:
            for c in existing_linked_pdfs:
                print(f"  linked PDF already attached: {c['key']} -> {c['data'].get('path', '')}")
            print("Nothing to do. Delete the existing attachment in Zotero first to re-ingest.")
            return

    # Download PDF (only if we will actually need to attach it)
    if not pdf_path.exists():
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading {meta['pdf_url']}")
        with urlopen(meta["pdf_url"], timeout=60) as r, open(pdf_path, "wb") as f:
            f.write(r.read())
    else:
        print("(PDF already exists, skipping download)")

    if not item_key:
        tpl = zot.item_template("preprint")
        tpl.update({
            "title": meta["title"],
            "creators": [
                {"creatorType": "author", "firstName": fn, "lastName": ln}
                for fn, ln in (split_name(a) for a in meta["authors"])
            ],
            "abstractNote": meta["abstract"],
            "repository": "arXiv",
            "archiveID": f"arXiv:{args.arxiv}",
            "date": meta["date"],
            "url": f"https://arxiv.org/abs/{args.arxiv}",
            "language": "en",
            "libraryCatalog": "arXiv",
            "extra": f"arXiv:{args.arxiv}",
            "tags": [{"tag": t} for t in args.tags],
            "collections": [coll_key],
        })
        resp = zot.create_items([tpl])
        ok = resp.get("successful") or resp.get("success") or {}
        if not ok:
            sys.exit(f"Failed to create item: {resp}")
        item_key = list(ok.values())[0]["key"]
        print(f"Created item: {item_key}")

    # Clean up earlier failed-upload stubs (empty imported_file children)
    for c in zot.children(item_key):
        d = c["data"]
        if (d.get("itemType") == "attachment"
                and d.get("linkMode") == "imported_file"
                and not d.get("md5")):
            print(f"  cleaning failed-upload stub {c['key']}")
            zot.delete_item(c)

    atpl = zot.item_template("attachment", "linked_file")
    atpl.update({
        "title": pdf_name,
        "path": str(pdf_path),
        "contentType": "application/pdf",
        "parentItem": item_key,
    })
    resp = zot.create_items([atpl])
    ok = resp.get("successful") or resp.get("success") or {}
    if not ok:
        sys.exit(f"Failed to attach linked file: {resp}")
    print(f"Created linked attachment: {list(ok.values())[0]['key']}")


if __name__ == "__main__":
    main()
