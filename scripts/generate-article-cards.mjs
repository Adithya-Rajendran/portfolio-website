import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

// Input is exported article metadata, not credentials. Upload the PNGs to
// each post's Sharing Image field in Sanity; publishing needs no site build.
const [input, output] = process.argv.slice(2);
if (!input || !output) {
    throw new Error(
        "Usage: node scripts/generate-article-cards.mjs posts.json output-directory",
    );
}
const posts = JSON.parse(await readFile(input, "utf8"));
const escape = (text) =>
    String(text).replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&apos;",
            })[c],
    );
const fontfile = resolve("public/fonts/Manrope-Variable.ttf");
await mkdir(output, { recursive: true });
const cards = [];
for (const post of posts) {
    const slug = typeof post.slug === "string" ? post.slug : post.slug?.current;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "")) {
        throw new Error("Each article needs a valid slug");
    }
    const title = await sharp({
        text: {
            text: escape(post.title),
            font: "Manrope Bold 64",
            fontfile,
            width: 1040,
            height: 240,
            rgba: true,
        },
    })
        .png()
        .toBuffer();
    const label = (post.tags || []).slice(0, 3).join(" / ").toUpperCase();
    const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <rect width="1200" height="630" fill="#10191c"/>
      <path d="M0 0H1200" stroke="#e8ab63" stroke-width="12"/>
      <circle cx="1145" cy="650" r="340" fill="none" stroke="#b2c9a1" stroke-opacity=".18"/>
      <circle cx="1145" cy="650" r="275" fill="none" stroke="#b2c9a1" stroke-opacity=".18"/>
      <circle cx="1000" cy="418" r="6" fill="#e8ab63"/>
      <text x="80" y="100" fill="#b2c9a1" font-family="sans-serif" font-size="20" letter-spacing="3">${escape(label || "ENGINEERING NOTES")}</text>
      <path d="M80 494H1120" stroke="#b2c9a1" stroke-opacity=".35"/>
      <text x="80" y="545" fill="#f5efdf" font-family="sans-serif" font-size="25">Adithya Rajendran</text>
      <text x="80" y="580" fill="#b2c9a1" font-family="sans-serif" font-size="19">adithya-rajendran.com · Field notes</text>
    </svg>`;
    // Pango text starts black. Preserve its alpha while applying the palette.
    const mask = await sharp(title).ensureAlpha().extractChannel(3).toBuffer();
    const { width, height } = await sharp(title).metadata();
    const coloredTitle = await sharp({
        create: {
            width,
            height,
            channels: 3,
            background: "#f5efdf",
        },
    })
        .joinChannel(mask)
        .png()
        .toBuffer();
    const filename = resolve(output, `${slug}.png`);
    await sharp(Buffer.from(background))
        .composite([{ input: coloredTitle, left: 80, top: 170 }])
        .png()
        .toFile(filename);
    cards.push({
        id: post._id,
        slug,
        title: post.title,
        filename,
        alt: `${post.title}. An engineering note by Adithya Rajendran.`,
    });
}
await writeFile(resolve(output, "cards.json"), JSON.stringify(cards, null, 2));
console.log(
    `Created ${cards.length} article sharing images in ${resolve(output)}`,
);
