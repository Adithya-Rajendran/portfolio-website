---
type: procedure
title: Download the original images from Sanity
depends: []
---
# Download the original images from Sanity

Use this procedure to replace the images that the CDN encoded again with the original images.
The export checks each original against its SHA-1.

## Prerequisites

- You have a Viewer token for the Sanity project. To make one, go to manage.sanity.io, then API, then Tokens.

## Procedure

1. Run the export with the token.
   ```sh
   SANITY_TOKEN=<token> python3 tools/sanity-export.py
   ```

## Verification

- The export deletes `data/assets/cdn-copies.json` when no copies from the CDN are in the archive.
