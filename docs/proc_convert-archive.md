---
type: procedure
title: Make the content files from the archive
depends: [docs/ref_sanity-conversion.md]
---
# Make the content files from the archive

Use this procedure after a new export from Sanity.
The tool writes only the files that do not exist, as [the conversion](ref_sanity-conversion.md) tells.

## Procedure

1. Run the conversion.
   ```sh
   python3 tools/sanity_to_md.py
   ```
2. Read each file that the tool shows as `DIFFERS`.
3. Run the conversion with `--force` only if the result of the conversion must replace the changes by hand.
   ```sh
   python3 tools/sanity_to_md.py --force
   ```
4. Run the tests of the conversion.
   ```sh
   python3 -m unittest tools/test_sanity_to_md.py
   ```

## Verification

- The tool stops with the exit code 0.
- The tests of the conversion pass.
