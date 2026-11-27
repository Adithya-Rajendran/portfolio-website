---
type: procedure
title: Add a project
depends: [docs/ref_project-file.md]
---
# Add a project

Use this procedure to add a project to Fabrication.

## Procedure

1. Write the project in a new file `data/projects/<slug>.md`, in the format of [the project file](ref_project-file.md).
2. Give the project an `order` that no other project has.
3. Run the content check.
   ```sh
   python3 tools/content.py
   ```
4. Run the page generator.
   ```sh
   python3 tools/site.py
   ```

## Verification

- `tools/content.py` shows the new project and no error.
- The file `public/portfolio/<slug>/index.html` exists.
