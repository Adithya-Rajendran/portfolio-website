#!/usr/bin/env python3
"""Copy the Sanity portfolio-blog content into data/.

    python3 tools/sanity-export.py            # project ppk2h9tb, dataset production

Reads the dataset export (public dataset, so no token; set SANITY_TOKEN for a private one) and writes
  data/profile/profile.json, data/posts/<slug>.json, data/projects/<slug>.json  (one document per file)
  data/assets/images.json, data/assets/files.json                               (the asset documents)
  data/assets/images/<sha1>-<w>x<h>.<ext>, data/assets/files/<sha1>.<ext>       (the binaries, SHA-1 checked)
Sanity system documents (groups, retention, schema) are left out. Re-running replaces what it wrote.

Files always come back as uploaded. Original image bytes need a token (Viewer is enough): without one the image CDN
re-encodes some images, and those are kept but listed in data/assets/cdn-copies.json until a run with SANITY_TOKEN.
"""
import hashlib, json, os, re, sys, urllib.request

PROJECT = os.environ.get("SANITY_PROJECT", "ppk2h9tb")
DATASET = os.environ.get("SANITY_DATASET", "production")
API = "v2025-02-19"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
FOLDERS = {"post": "posts", "project": "projects", "profile": "profile"}
ASSETS = {"sanity.imageAsset": "images", "sanity.fileAsset": "files"}
ASSET_NAME = re.compile(r"^[0-9a-f]{40}(-\d+x\d+)?\.[a-z0-9]+$")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "sanity-export/1"})
    if os.environ.get("SANITY_TOKEN"):
        req.add_header("Authorization", "Bearer " + os.environ["SANITY_TOKEN"])
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def write_json(path, value):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(value, f, indent=2, ensure_ascii=False)
        f.write("\n")


def sha1(path):
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()


def main():
    raw = get(f"https://{PROJECT}.api.sanity.io/{API}/data/export/{DATASET}").decode("utf-8")
    docs = [json.loads(line) for line in raw.splitlines() if line.strip()]
    docs = [d for d in docs if not d["_type"].startswith("system.") and not d["_id"].startswith(("drafts.", "versions."))]

    by_folder = {}
    for d in docs:
        if d["_type"] in ASSETS:
            continue
        folder = FOLDERS.get(d["_type"], d["_type"])
        name = (d.get("slug") or {}).get("current") or d["_id"]
        name = re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")
        by_folder.setdefault(folder, {})
        if name in by_folder[folder]:
            sys.exit(f"two {d['_type']} documents would both be {folder}/{name}.json")
        by_folder[folder][name] = d

    for folder, items in sorted(by_folder.items()):
        out = os.path.join(ROOT, folder)
        if os.path.isdir(out):
            for old in os.listdir(out):
                if old.endswith(".json") and old[:-5] not in items:
                    os.remove(os.path.join(out, old))
        for name, d in items.items():
            write_json(os.path.join(out, name + ".json"), d)
        print(f"{folder}: {len(items)} documents")

    token = bool(os.environ.get("SANITY_TOKEN"))
    copies_path = os.path.join(ROOT, "assets", "cdn-copies.json")
    copies = {}
    for asset_type, folder in ASSETS.items():
        assets = sorted((d for d in docs if d["_type"] == asset_type), key=lambda d: d["_id"])
        out = os.path.join(ROOT, "assets", folder)
        os.makedirs(out, exist_ok=True)
        keep, fetched = set(), 0
        for a in assets:
            name = a["url"].rsplit("/", 1)[1]
            if not ASSET_NAME.match(name):
                sys.exit(f"unexpected asset file name {name!r} for {a['_id']}")
            keep.add(name)
            path = os.path.join(out, name)
            if os.path.exists(path) and sha1(path) == a["sha1hash"]:
                continue
            image = asset_type == "sanity.imageAsset"
            if os.path.exists(path) and image and not token:  # a CDN copy from an earlier run; only a token improves it
                copies[a["_id"]] = {"path": f"{folder}/{name}", "originalSha1": a["sha1hash"], "originalSize": a["size"],
                                    "sha1": sha1(path), "size": os.path.getsize(path)}
                continue
            data = get(a["url"] + ("?dlRaw=true" if image and token else ""))
            digest = hashlib.sha1(data).hexdigest()
            if digest != a["sha1hash"] or len(data) != a["size"]:
                if not image or token:
                    sys.exit(f"{a['_id']}: download does not match its SHA-1 or size")
                copies[a["_id"]] = {"path": f"{folder}/{name}", "originalSha1": a["sha1hash"], "originalSize": a["size"],
                                    "sha1": digest, "size": len(data)}
            with open(path, "wb") as f:
                f.write(data)
            fetched += 1
        for old in os.listdir(out):
            if old not in keep:
                os.remove(os.path.join(out, old))
        write_json(os.path.join(ROOT, "assets", folder + ".json"), assets)
        print(f"assets/{folder}: {len(assets)} ({fetched} downloaded, {len(assets) - fetched} already current)")

    if copies:
        write_json(copies_path, dict(sorted(copies.items())))
        print(f"{len(copies)} images are CDN re-encodes, not the uploaded originals (data/assets/cdn-copies.json);"
              " run again with SANITY_TOKEN set to replace them")
    elif os.path.exists(copies_path):
        os.remove(copies_path)


if __name__ == "__main__":
    main()
