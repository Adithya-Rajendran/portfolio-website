// loadSite() and furnish(): what the rooms say from the published posts, projects and profile.
const get = (url, none) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : none)).catch(() => none);
export async function loadSite() {
  const [blog, portfolio, profile] = await Promise.all([get('blog/index.json', { posts: [] }), get('portfolio/index.json', { projects: [] }), get('profile.json', null)]);
  return { posts: blog?.posts ?? [], projects: portfolio?.projects ?? [], profile: profile?.timeline && profile.contact ? profile : null };
}
const up = (s) => s.toUpperCase(), cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s), join = (...parts) => parts.filter(Boolean).join('  ·  ');
const role = (e) => (e.title.length > 44 ? e.title.split(' (')[0] : e.title);
const fill = (v, from) => (typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (m, k) => (from[k] != null && from[k] !== '' ? String(from[k]).replace(/[{}]/g, '') : m)) : Array.isArray(v) ? v.map((x) => fill(x, from)) : v);

export function furnish(content, { posts, projects, profile }) {
  const R = content.rooms;
  R.writing.volumes = posts;

  {
    const P = R.projects, by = new Map(projects.map((p) => [p.slug, p]));
    const ranked = [...projects].sort((a, b) => (a.featured ?? 99) - (b.featured ?? 99) || a.quiet - b.quiet || projects.indexOf(b) - projects.indexOf(a));
    const named = P.exhibits.map((slug) => by.get(slug) ?? null), rest = ranked.filter((p) => !named.includes(p)), shown = named.map((p) => p ?? rest.shift() ?? null);
    P.screens.list = P.screens.list.map((card, i) => (shown[i] ? { ...card, layout: 'card', title: up(shown[i].types.join(' · ')), tag: up(shown[i].status_label), name: shown[i].name,
      meta: up(join(shown[i].period, shown[i].role && cut(shown[i].role, 44))), text: shown[i].summary, url: shown[i].url } : card));
    P.exhibits = shown.map((p) => (p ? { url: p.url, name: p.name } : null));
    for (const k of ['facts', 'cta']) P[k] = fill(P[k], { count: projects.length, shown: shown.filter(Boolean).length });
    if (!projects.length) { delete P.cta; delete P.ctaReads; }
  }
  if (!profile) { R.experience.facts = R.experience.facts.slice(0, 1); R.lobby.sub = R.about.sub = []; delete R.about.cta; delete R.about.ctaReads; return; }
  const words = { name: profile.name, headline: profile.headline, location: profile.location, tagline: profile.tagline };

  if (profile.timeline.length) {
    const X = R.experience, line = [...profile.timeline].reverse(), wall = line.slice(-X.screens.list.length);
    X.screens.list = X.screens.list.map((card, i) => (wall[i] ? { ...card, layout: 'card', title: up(wall[i].org_short), tag: wall[i].current ? X.now : up(wall[i].kind), figure: wall[i].year,
      name: role(wall[i]), meta: up(join(wall[i].period, wall[i].location)), text: wall[i].summary ?? '', url: wall[i].url } : card));
    X.stations = line.map((e, i) => ({ title: e.current ? X.now : e.year, sub: up(e.org_short), model: i === line.length - 1 ? X.models.at(-1) : X.models[i % (X.models.length - 1)], url: e.url,
      specs: [['ROLE', cut(role(e), 26)], ['AT', cut(e.organization, 26)], ['FROM – TO', up(e.period)], e.location ? ['PLACE', up(cut(e.location, 26))] : ['KIND', up(e.kind)]] }));
    X.facts = fill(X.facts, { stations: line.length === 1 ? '1 station' : `${line.length} stations`, since: line[0].year });
  }

  const A = R.about, first = profile.curiosities[0];
  A.screens.list = A.screens.list.map((card, i) => (i === 0 ? { ...card, layout: 'card', name: profile.name, meta: up(join(profile.headline, profile.location)), text: profile.tagline }
    : first ? { ...card, layout: 'card', name: first.title, meta: up(join(...profile.focus)), text: first.note ?? '' } : card));
  for (const r of [A, R.lobby]) r.sub = fill(r.sub, words).filter((l) => !/\{\w+\}/.test(l));

  const C = R.comms.comms, sought = profile.availability?.status === 'open' ? profile.availability.seeking ?? [] : [];
  const contactLinks = profile.contact.links ?? profile.links ?? [];
  Object.assign(C, { name: profile.name, intro: profile.contact.intro, invitation: profile.contact.invitation ?? '', seeking: sought,
    links: [...contactLinks.slice(0, profile.resume ? 5 : 6).map((l) => [l.label, l.url]), ...(profile.resume ? [[C.resume, profile.resume]] : [])] });
  const invite = { layout: 'card', name: profile.contact.intro, meta: up(join(profile.name, profile.location)), text: profile.contact.invitation ?? '' };
  R.comms.screens.list = R.comms.screens.list.map((card, i) => (i === 0 || !sought.length ? { ...card, ...invite } : { ...card, layout: 'card', name: sought.join('  ·  '), meta: up(profile.headline), text: '' }));
}
