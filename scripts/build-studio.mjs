import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
if (!process.env.SANITY_STUDIO_PROJECT_ID || !process.env.SANITY_STUDIO_DATASET)
    throw new Error(
        "Set SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET before building Studio.",
    );
execFileSync("sanity", ["build", "public/studio", "--yes"], {
    stdio: "inherit",
});
const path = "public/studio/index.html";
writeFileSync(
    path,
    readFileSync(path, "utf8").replaceAll('"/static/', '"/studio/static/'),
);
