---
type: procedure
title: Download the original images from Sanity
depends: []
---
# Download the original images from Sanity

Use this procedure to download the original images from Sanity again.
Without a token, the CDN of Sanity gives images that it encoded again.

## Prerequisites

- You have a Viewer token for the Sanity project. To make one, go to manage.sanity.io, then API, then Tokens.

## Procedure

1. Run the export with the token.
   ```sh
   SANITY_TOKEN=<token> python3 tools/sanity-export.py
   ```

## Verification

- The output of the export does not list images that the CDN encoded again.
- `data/assets/cdn-copies.json` is not there. The export writes this file only when it keeps a copy from the CDN.
