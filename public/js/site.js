// What the rooms say that comes from the content in data/ (posts, projects, the profile), as tools/site.py publishes it:
// blog/index.json, portfolio/index.json and profile.json (docs/v1-contracts.md §3, §8). content.json holds the rooms' own
// words and the places for these; furnish() fills the places. A file that is not there yet leaves its room as it was.
const get = (url, none) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : none)).catch(() => none);
export async function loadSite() {
  const [blog, portfolio, profile] = await Promise.all([get('blog/index.json', { posts: [] }), get('portfolio/index.json', { projects: [] }), get('profile.json', null)]);
  return { posts: blog?.posts ?? [], projects: portfolio?.projects ?? [], profile: profile?.timeline && profile.contact ? profile : null };      // a file of another shape counts as not there
}
const up = (s) => s.toUpperCase(), cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s), join = (...parts) => parts.filter(Boolean).join('  ·  ');
const role = (e) => (e.title.length > 44 ? e.title.split(' (')[0] : e.title);      // "Field Software Engineer I (promoted from ...)": a long aside is left to the page
/** Words with {name} places in them, filled from `from`; a place it has no value for is left (main.js fills the live ones). */
const fill = (v, from) => (typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (m, k) => (k in from ? String(from[k]).replace(/[{}]/g, '') : m)) : Array.isArray(v) ? v.map((x) => fill(x, from)) : v);      // a value brings no places of its own

export function furnish(content, { posts, projects, profile }) {
  const R = content.rooms;
  R.writing.volumes = posts;                                      // the Library's shelves (js/room.js takes as many as it has places for)

  // Fabrication: an exhibit and its placard stand for a project. content.json may name the project for a place ("exhibits");
  // the other places go to the featured projects, then the newest that are not marked quiet.
  {
    const P = R.projects, by = new Map(projects.map((p) => [p.slug, p]));
    const ranked = [...projects].sort((a, b) => (a.featured ?? 99) - (b.featured ?? 99) || a.quiet - b.quiet || projects.indexOf(b) - projects.indexOf(a));
    const named = P.exhibits.map((slug) => by.get(slug) ?? null), rest = ranked.filter((p) => !named.includes(p)), shown = named.map((p) => p ?? rest.shift() ?? null);
    P.screens.list = P.screens.list.map((card, i) => (shown[i] ? { ...card, layout: 'card', title: up(shown[i].types.join(' · ')), tag: up(shown[i].status_label), name: shown[i].name,
      meta: up(join(shown[i].period, shown[i].role && cut(shown[i].role, 44))), text: shown[i].summary, url: shown[i].url } : card));
    P.exhibits = shown.map((p) => (p ? { url: p.url, name: p.name } : null));        // the visitor's display names each exhibit for its project
    for (const k of ['sub', 'facts', 'cta']) P[k] = fill(P[k], { count: projects.length, shown: shown.filter(Boolean).length });
    if (!projects.length) { delete P.cta; delete P.ctaReads; P.screens.list = P.screens.list.map((card) => ({ ...card, cta: '' })); }      // nothing to read yet
  }
  if (!profile) { R.experience.screens.list = R.experience.screens.list.map((card) => ({ ...card, cta: '' })); R.experience.sub = R.experience.sub.slice(0, 1); R.experience.facts = R.experience.facts.slice(0, 1); R.about.sub = R.about.sub.slice(0, 1); delete R.about.cta; delete R.about.ctaReads; return; }
  const words = { name: profile.name, headline: profile.headline, location: profile.location, tagline: profile.tagline };

  // Navigation: the line is the timeline, laid oldest first, its newest stop the one being built now. The wall carries
  // the last few stops as cards; the route map has a station for each, with a megastructure for its emblem.
  if (profile.timeline.length) {
    const X = R.experience, line = [...profile.timeline].reverse(), wall = line.slice(-X.screens.list.length);
    X.screens.list = X.screens.list.map((card, i) => (wall[i] ? { ...card, layout: 'card', title: up(wall[i].org_short), tag: wall[i].current ? X.now : up(wall[i].kind), figure: wall[i].year,
      name: role(wall[i]), meta: up(join(wall[i].period, wall[i].location)), text: wall[i].summary ?? '', url: wall[i].url } : card));
    X.stations = line.map((e, i) => ({ title: e.current ? X.now : e.year, sub: up(e.org_short), model: i === line.length - 1 ? X.models.at(-1) : X.models[i % (X.models.length - 1)], url: e.url,
      specs: [['ROLE', cut(role(e), 26)], ['AT', cut(e.organization, 26)], ['FROM – TO', up(e.period)], e.location ? ['PLACE', up(cut(e.location, 26))] : ['KIND', up(e.kind)]] }));
    X.screens.list = X.screens.list.map((card) => (card.url ? card : { ...card, cta: '' }));
    for (const k of ['sub', 'facts']) X[k] = fill(X[k], { stations: line.length === 1 ? '1 station' : `${line.length} stations`, since: line[0].year });
  }

  // the Lounge: who this is, on the wall and in the book on the table
  const A = R.about, first = profile.curiosities[0];
  A.screens.list = A.screens.list.map((card, i) => (i === 0 ? { ...card, layout: 'card', name: profile.name, meta: up(join(profile.headline, profile.location)), text: profile.tagline }
    : first ? { ...card, layout: 'card', name: first.title, meta: up(join(...profile.focus)), text: first.note ?? '' } : card));
  A.sub = fill(A.sub, words);

  // Comms: who a message goes to, and the other ways there
  const C = R.comms.comms;
  Object.assign(C, { to: up(profile.name), write: profile.contact.intro, address: profile.contact.email ?? '',
    socials: [...profile.links.slice(0, profile.resume ? 4 : 5).map((l) => [up(l.label), l.url]), ...(profile.resume ? [[C.resume, profile.resume]] : [])] });      // the field has room for five
}
