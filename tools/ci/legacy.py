# Legacy list reader and the shrinking-list rule for the documentation and comment checks.
import hashlib
import os
import subprocess

KINDS = ("docs", "comments")
SKIP_DIRS = (".git",)


def tracked_files(root):
    if os.path.exists(os.path.join(root, ".git")):
        try:
            out = subprocess.run(["git", "-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], capture_output=True, check=True).stdout
            return sorted(p for p in out.decode().split("\0") if p and os.path.isfile(os.path.join(root, p)))
        except (OSError, subprocess.CalledProcessError):
            pass
    found = []
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            found.append(os.path.relpath(os.path.join(d, f), root).replace(os.sep, "/"))
    return sorted(found)


def digest(data):
    return hashlib.sha256(data).hexdigest()[:16]


def read(path, kind):
    entries = {}
    if not path or not os.path.isfile(path):
        return entries
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 2)
            if len(parts) != 3 or parts[0] not in KINDS:
                raise SystemExit("%s:%d: a line must be '<docs|comments> <hash> <path>'" % (path, n))
            if parts[0] == kind:
                entries[parts[2]] = parts[1]
    return entries


def read_bases(paths, kind):
    return [(os.path.basename(p), read(p, kind)) for p in paths or []]


def apply(results, digests, legacy, bases, legacy_name):
    errors = []
    for path in sorted(results):
        problems = results[path]
        listed = path in legacy
        if listed and not problems:
            errors.append("%s: obeys the rules now: remove its line from %s" % (path, legacy_name))
        elif listed and legacy[path] == digests.get(path):
            continue
        else:
            errors += ["%s: %s" % (path, p) for p in problems]
    for path in sorted(legacy):
        if path not in results:
            errors.append("%s: %s is not a checked file: remove its line" % (legacy_name, path))
        for name, base in bases or []:
            if path not in base:
                errors.append("%s: %s is not on the base list %s: the list must not grow" % (legacy_name, path, name))
            elif legacy[path] != base[path]:
                errors.append("%s: the line of %s is not the same as on the base list %s: a line may only be removed" % (legacy_name, path, name))
    return errors


def skipped(results, digests, legacy):
    return sum(1 for p in results if p in legacy and legacy[p] == digests.get(p) and results[p])


def seed_lines(kind, results, digests):
    return ["%s %s %s" % (kind, digests[p], p) for p in sorted(results) if results[p]]