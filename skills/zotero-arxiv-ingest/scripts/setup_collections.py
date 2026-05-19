"""Create a Zotero collection tree from a JSON spec (idempotent).

Usage:
    uv run --with pyzotero --with python-dotenv python setup_collections.py \
        --env /path/to/project/.env \
        --tree '{"CL_LLM": {"Surveys": {}, "Methods": {"X": {}, "Y": {}}}}' \
        --out /path/to/project/.zotero_collections.json

Or pass a JSON file path:
    --tree-file collection_tree.json

The script is idempotent: re-running on an existing tree only creates missing
collections and re-emits the full {path -> key} mapping.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    from pyzotero import zotero
except ImportError:
    sys.exit("Run inside an env with pyzotero + python-dotenv installed, e.g. "
             "uv run --with pyzotero --with python-dotenv python ...")


def index_existing(zot: "zotero.Zotero") -> dict[tuple[str | None, str], str]:
    """Map (parent_key_or_None, name) -> collection key."""
    out: dict[tuple[str | None, str], str] = {}
    for c in zot.everything(zot.collections()):
        parent = c["data"].get("parentCollection") or None
        out[(parent, c["data"]["name"])] = c["key"]
    return out


def ensure_collection(zot, name: str, parent: str | None, idx: dict) -> str:
    key = idx.get((parent, name))
    if key:
        print(f"  [exists]  {name:50s} -> {key}")
        return key
    payload: dict = {"name": name}
    if parent:
        payload["parentCollection"] = parent
    resp = zot.create_collections([payload])
    success = resp.get("successful") or resp.get("success") or {}
    if not success:
        raise RuntimeError(f"Failed to create '{name}': {resp}")
    new_key = list(success.values())[0]["key"]
    print(f"  [created] {name:50s} -> {new_key}")
    idx[(parent, name)] = new_key
    return new_key


def walk(zot, subtree: dict, parent: str | None, idx: dict,
         prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for name, children in subtree.items():
        key = ensure_collection(zot, name, parent, idx)
        path = f"{prefix}/{name}" if prefix else name
        out[path] = key
        if isinstance(children, dict) and children:
            out.update(walk(zot, children, key, idx, path))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True, help="Path to .env with ZOTERO_* vars")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--tree", help="Collection tree as inline JSON")
    g.add_argument("--tree-file", help="Path to JSON file with collection tree")
    ap.add_argument("--out", help="Where to save {path -> key} mapping JSON")
    args = ap.parse_args()

    load_dotenv(args.env)

    if args.tree:
        tree = json.loads(args.tree)
    else:
        tree = json.loads(Path(args.tree_file).read_text())
    if not isinstance(tree, dict):
        sys.exit("Tree must be a JSON object (nested dicts of names).")

    zot = zotero.Zotero(
        library_id=os.environ["ZOTERO_LIBRARY_ID"],
        library_type=os.environ["ZOTERO_LIBRARY_TYPE"],
        api_key=os.environ["ZOTERO_API_KEY"],
    )

    print("Indexing existing collections...")
    idx = index_existing(zot)
    print(f"  {len(idx)} existing collections found\n")

    print("Building tree:")
    mapping = walk(zot, tree, None, idx)

    print("\nFinal mapping:")
    for path, key in mapping.items():
        print(f"  {path:60s}  {key}")

    if args.out:
        Path(args.out).write_text(json.dumps(mapping, indent=2, ensure_ascii=False))
        print(f"\nWrote mapping -> {args.out}")


if __name__ == "__main__":
    main()
