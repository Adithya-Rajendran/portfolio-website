// loadData(): the content of the rooms and the published posts, projects and profile, which the page requests before the station code arrives.
const get = (url, none) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : none)).catch(() => none);

export async function loadSite() {
  const [blog, portfolio, profile] = await Promise.all([get('blog/index.json', { posts: [] }), get('portfolio/index.json', { projects: [] }), get('profile.json', null)]);
  return { posts: blog?.posts ?? [], projects: portfolio?.projects ?? [], profile: profile?.timeline && profile.contact ? profile : null };
}

export const loadData = () => Promise.all([fetch('content.json').then((r) => r.json()), loadSite()]);
