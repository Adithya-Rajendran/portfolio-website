# Robotics and space: creative direction

The owner's latest direction is excitement about the future and the unknown, expressed through robotics and space. The warm amber/brick/green palette and automatically starting planetary experience remain requirements. The whole site should share this identity, with factual work as its foundation.

## Experience to create

Lead with wonder, then show the work behind it. Give the homepage a strong cinematic opening, confident typography, visible depth and a clear invitation to explore. Connect robotics/perception work to the curiosity of exploration; the space imagery is illustrative, not a claim that the owner built flight hardware or worked on NASA missions.

Hero heading: **Building toward the unknown.**

Kicker: **Robotics · Perception · Systems**

Keep Adithya's name, current role and introduction from the CMS visible. Do not fabricate achievements, research results or organizations. Two clear destinations: **Explore the work** to `/portfolio` and **Enter orbit** to `/resume`. Retain contact and availability information without turning the hero into a résumé wall.

## Visual system

- Use the user's exact amber `#DFA05D`, brick `#AC5045` and muted green `#658761` as intentional accents. Charcoal and warm cream remain the main surfaces; text variants must retain contrast.
- A cinematic JavaScript/Three.js robotics-and-space scene anchors the homepage. The owner explicitly requested JavaScript-made visuals and image generation only for planning. Use the generated rover/horizon concept in `assets/artwork/robotics-horizon-v1.png` as a design reference, never as a shipped hero bitmap. Build the rover, terrain, lighting and scene composition in code. Clearly label the scene as illustrative rather than hardware built by the owner.
- Use a dark, expansive hero in both light and dark themes, with a readable HTML text area and the rendered robot/planet prominent. Use genuine contrast, layered framing and a restrained orbital line or instrument-like marker, rather than many panels or fabricated telemetry.
- Add depth to featured work using its actual CMS covers where available, stronger hierarchy, and precise hover/focus response. Preserve project summaries and links. Writing should feel like field notes from ongoing learning but retain the normal Writing label and article URLs.
- Give the navigation and headings a consistent visual character across project, article, About and contact pages. The reading surface must remain quiet, with readable long-form text.
- Use restrained entrance/hover motion to suggest discovery. Respect reduced motion, and never hide SSR content until JavaScript runs. The homepage robotics scene automatically starts and uses restrained ambient motion; the existing planetary scene remains fully interactive and automatically starts on `/resume`. Both honor reduced motion and pause offscreen.
- Keep saved theme choices and keyboard use working. Avoid motion-heavy backgrounds on article pages. Mobile camera framing should retain the robot subject without covering text.

## Implementation ownership and review

GPT-6.1-Terra owns application changes. Parent provides the image-generated planning reference, copy direction and visual review; the graphics agent implements the actual JavaScript scene. Do not change the working Worker/DNS/contact configuration. Use bounded rendering resolution, deterministic geometry and efficient shared/instanced materials. The generated concept bitmap is not a production dependency. Actual CMS project photos remain factual content. Before publishing, review real home desktop/mobile screenshots in both themes, plus one article and project page to confirm a coherent visual identity and readable content. Reuse relevant existing gates; do not add tests that just mirror CSS.
