import { execFileSync } from "node:child_process";
import {
    existsSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
if (!process.env.SANITY_STUDIO_PROJECT_ID || !process.env.SANITY_STUDIO_DATASET)
    throw new Error(
        "Set SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET before building Studio.",
    );
execFileSync("sanity", ["build", "public/studio", "--yes"], {
    stdio: "inherit",
});
// sanity.cli.ts turns Vite's publicDir off so the Studio does not copy the
// site's public files. Should a CLI version ignore that, remove the copies:
// only names that exist in public/ itself, never the Studio's own output.
const studioOwn = new Set(["index.html", "static", "vendor"]);
for (const name of readdirSync("public")) {
    if (name === "studio" || studioOwn.has(name)) continue;
    rmSync(`public/studio/${name}`, { recursive: true, force: true });
}
for (const required of ["index.html", "static"])
    if (!existsSync(`public/studio/${required}`))
        throw new Error(`Studio build is missing public/studio/${required}.`);
const path = "public/studio/index.html";
writeFileSync(
    path,
    readFileSync(path, "utf8").replaceAll('"/static/', '"/studio/static/'),
);
