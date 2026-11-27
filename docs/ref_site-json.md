---
type: reference
title: The JSON files of the site
depends: [docs/ref_room-pages.md, docs/ref_project-file.md, docs/ref_profile-file.md]
---
# The JSON files of the site

This reference gives the JSON files that the page generator writes for the rooms from the projects and the profile.

## portfolio/index.json

```json
{ "v": "<8 hex>",
  "projects": [ { "slug": "homelab", "url": "/portfolio/homelab/", "name": "Homelab", "title": "Rebuildable OpenStack homelab",
                  "summary": "…", "status": "active", "status_label": "Active", "period": "2022 – now", "year": "2022",
                  "types": ["infrastructure"], "role": "…", "technologies": ["MAAS", "Juju"], "featured": null, "quiet": false } ] }
```

- The keys are in this order.
- `v` is the first 8 hex characters of the SHA-256 of the `projects` list as JSON with sorted keys. It changes when any part of the file changes.
- The list is in the sequence of `order` of [the project file](ref_project-file.md), not in the order of `/portfolio/`.
- `status` and `types` have the values of the project file. `status_label` is `Active` or `Complete`.
- `period` follows [the rules of the dates](ref_room-pages.md#dates-and-labels), for example `"Dec 2022 – Oct 2026"`, `"2026"` or `"2022 – now"`. It is `null` when the project has no dates.
- `year` is the year that the project started, or `null` without `started`.
- `role` and `featured` can be `null`. `featured` is a rank, with 1 first.
- `technologies` is `[]` when the project has none. `quiet` is `false` when the project does not have it.

## profile.json

```json
{ "v": "<8 hex>", "name": "…", "headline": "…", "tagline": "…", "location": "…", "introduction": "…", "focus": ["…"],
  "availability": { "status": "open", "label": "Write about a role", "seeking": ["Summer 2027 internships"] },
  "curiosities": [ { "kind": "question", "title": "…", "note": "…", "url": null } ],
  "timeline": [ { "id": "canonical-2024", "url": "/experience/#canonical-2024", "kind": "work", "title": "…", "organization": "…", "org_short": "Canonical",
                  "period": "May 2024 – Jul 2026", "year": "2024", "current": false, "location": "Remote", "employment": "full-time", "summary": "…" } ],
  "links": [ { "label": "LinkedIn", "url": "https://…" } ],
  "contact": { "intro": "…", "invitation": "…", "links": [ { "label": "LinkedIn", "url": "https://…" } ], "routes": [ { "id": "hello", "title": "Hello", "prompt": "…" } ] },
  "resume": "/resume/<file>.pdf" }
```

- The file gives the parts of [the profile](ref_profile-file.md) that the rooms show, as plain text with no markup.
- The keys are in this order.
- `v` is the first 8 hex characters of the SHA-256 of the other keys of the object as JSON with sorted keys.
- `timeline` has the last entry first.
- `availability`, `resume` and the fields of a record that are not necessary can be `null`. At this time `availability` is not `null`, because the profile must have it.
- A `url` value is a path of the site or an `http` or `https` URL.
- `focus` is `focus_areas`, or `[]` without it.
- `availability.label` is `cta`. `seeking` is `[]` without it.
- The `kind` of a curiosity is `"question"` when its title ends with `?`, and `null` if not, because the profile has no field for it.
- The `note` of a curiosity can be `null`. Its `url` is `/portfolio/<slug>/` of its project, or `null`.
- In a timeline entry, `period` is the timeline period and `year` is the year of `start_date`.
- `current` is `is_current`, or `false` without it.
- `location`, `employment` and `summary` can be `null`. `employment` has the value of the profile, for example `full-time`.
- `links` are all `social_links`, which `/about/` uses.
- `contact.links` are the `contact_links` in their order, or `social_links` without `contact_links`.
- `contact.routes` are the `contact_routes` in the order of the profile.
- `resume` is `/resume/<original name, percent-encoded>`, or `null`.
