// The room and the reading that an address of the site names.
export function addresses(rooms) {
  const ROOMS = Object.entries(rooms).map(([id, r]) => [r.path, id]);
  const roomAt = (pathname) => { const first = `/${pathname.split('/')[1]}/`.replace('//', '/'); return [first === '/' ? null : ROOMS.find(([p]) => p === first)?.[1] ?? null, first]; };
  function route(u) {
    const path = u.pathname.replace(/\/?$/, '/'), [at, base] = roomAt(path);
    return { id: at ?? 'lobby', read: at && (path !== base || u.hash.length > 1) ? path + u.hash : null };
  }
  return { roomAt, route };
}
