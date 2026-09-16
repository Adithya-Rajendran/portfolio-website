# Remaining-page review

Reviewed the shipped Writing, Archive, article, Work, About, and Résumé pages
against the writing-first brief and the confirmed move from Canonical to SJSU.
The quiet stars, restrained copper accents, and readable editorial layouts remain
appropriate. The largest gaps were the accuracy and organization of the content,
rather than a need for another visual redesign.

## Career pages

- **State the current direction clearly.** About and Work described current
  Canonical employment. The profile now supports a Sanity-authored introduction,
  Work summary, interests, and biography. The confirmed timeline is Canonical
  through July 2026, SJSU from August 2026, and expected graduation in **2028**.
  No graduation month is inferred. Current study has an explicit status, and
  search metadata separates current academic affiliation from completed education.
- **Put evidence within reach.** Work previously placed nine Canonical highlights
  and eight internship highlights before the rest of the page. The first three
  remain visible; native expandable details preserve the others. With no
  published projects, real articles supply concrete examples of engineering
  reasoning above the career history. These are not presented as robotics projects.
- **Keep the CMS authoritative.** Removing a profile link, location, or biography
  must not resurrect hardcoded content. About and contact channels use the saved
  profile. Empty career sections do not leave an unusable introduction link.
- **Keep the résumé consistent.** The original PDF still stated Canonical
  employment as present. The replacement needs the confirmed SJSU program and
  dates while retaining verified experience. The PDF remains a replaceable Sanity
  asset; changing profile text does not rewrite the file. An optional editable
  notice can explain a version or opportunity focus above the viewer.

A recruiter should understand the current degree, direction, relevant experience,
and ways to assess the work quickly. For a technical founder, the strongest
signal is a clearly explained problem and the decisions behind a working system.
The Canonical background supports that story; Robotics and AI remain the stated
study focus rather than an unsupported claim of professional specialization.

## Writing pages

- **Give the notebook a current purpose.** Writing introduction and collection
  metadata now use the profile's editable writing description. Individual article
  descriptions remain authored with their posts.
- **Make discovery useful.** Archive search, clear, and article heading links
  worked in the browser review. The published posts lacked tags, so topic
  discovery had no content to show. Tags should describe the actual articles;
  upcoming robotics interests should not be attached to unrelated older work.
  The three existing posts now have six relevant topic tags.
- **Make following consistent.** The LinkedIn action follows the profile's saved
  links and disappears if removed. RSS remains available. A duplicate RSS entry
  was removed from the secondary writing navigation.
- **Improve mobile reading controls.** The article contents summary originally
  had a roughly 16.5-pixel click target. Padding now belongs to the summary,
  producing a 50-pixel target. Large introductory gaps were reduced modestly.
- **Preserve historical context.** A dated article's discussion of Canonical is
  not a current employment claim and should not be rewritten solely because the
  author has moved on. Related-reading recommendations were not added in this pass.

## Verification and remaining checks

The original career pages loaded at desktop 1440 and mobile 390 widths with no
horizontal overflow or browser errors. Writing pages also passed at 320 pixels;
search and contents links were exercised. Integrated code review checked cached
server-side CMS reads, serializable contact props, labelled controls, native
keyboard-operable disclosures, link destinations, empty-content behavior, and
preservation of year-only expected graduation. Scoped formatting and lint passed.
The integrated pages passed desktop and 320-pixel checks against updated Sanity
content: current-study timeline, July 2026 Canonical end date, disclosures,
metadata, and RSS. All six topic links, archive search, and mobile contents controls
were exercised. No horizontal overflow or browser errors were observed.
