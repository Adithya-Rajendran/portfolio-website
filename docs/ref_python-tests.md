---
type: reference
title: The unit tests
depends: []
---
# The unit tests

This reference gives the unit tests that the `static` tier runs.

| Command | Tests |
|---|---|
| `python3 -m unittest tools/test_site.py` | The page generator, `tools/site.py`. |
| `python3 -m unittest tools/test_site_pages.py` | The pages of the projects and of the profile. |
| `python3 -m unittest tools/test_site_extras.py` | The endpoints of `tools/site_extras.py`. |
| `python3 -m unittest tools/test_content.py` | The content parser, `tools/content.py`. |
| `python3 -m unittest tools/test_sanity_to_md.py` | The conversion from Sanity. |
| `python3 -m unittest tools/test_geomcheck.py` | The geometry check, `tools/geomcheck.py`. |
| `python3 -m unittest tools/test_pack.py` | The pack tool, `tools/pack.py`. |
| `VALE=<vale> python3 -m unittest tools/comments/test_check.py tools/docs/test_check.py` | The comment check and the documentation check. `tools/docs/vale.sh` gives the path of Vale. |
| `node --test tools/test_*.mjs` | The governor, the DEV switch, the scan for the `room` query of the first version and the baseline rules of `tools/ci/ratchet.mjs`. |
