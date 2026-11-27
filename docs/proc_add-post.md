---
type: procedure
title: Add a post
depends: [docs/ref_post-file.md, docs/ref_python-tests.md]
---
# Add a post

Use this procedure to add a post to the Library.

## Procedure

1. Write the post in a new file `data/posts/<slug>.md`, in the format of [the post file](ref_post-file.md).
2. Copy each image of the post into `data/assets/images/`.
3. Run the content check.
   ```sh
   python3 tools/content.py
   ```
4. Run the page generator.
   ```sh
   python3 tools/site.py
   ```

## Verification

- `tools/content.py` shows the new post and no error.
- The file `public/blog/<slug>/index.html` exists.
- The [Python tests](ref_python-tests.md) pass.
