// The Library's catalogue: the posts, as tools/site.py lists them in blog/index.json. A post is a volume on the shelves:
// { slug, url, title, description, date, minutes, tags, sections }. Newest first.
export async function loadCatalogue() {
  try { const r = await fetch('blog/index.json', { cache: 'no-cache' }); if (r.ok) return (await r.json()).posts; } catch { /* not generated yet: empty shelves */ }
  return [];
}
