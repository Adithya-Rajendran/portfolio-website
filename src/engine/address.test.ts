// Unit tests of addresses(): the room and the reading that an address names.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { addresses } from './address.js';

const content = JSON.parse(readFileSync(new URL('../../public/content.json', import.meta.url), 'utf8'));
const { roomAt, route } = addresses(content.rooms);
const at = (pathname: string, hash = '') => route({ pathname, hash });

describe('route', () => {
  test('the root is the lobby with nothing to read', () => {
    expect(at('/')).toEqual({ id: 'lobby', read: null });
  });

  test('a room path names the room', () => {
    expect(at('/blog/')).toEqual({ id: 'writing', read: null });
    expect(at('/portfolio/')).toEqual({ id: 'projects', read: null });
    expect(at('/contact/')).toEqual({ id: 'comms', read: null });
  });

  test('a path without its last slash names the same room', () => {
    expect(at('/experience')).toEqual({ id: 'experience', read: null });
  });

  test('a path under a room is a reading in that room', () => {
    expect(at('/blog/my-homelab/')).toEqual({ id: 'writing', read: '/blog/my-homelab/' });
    expect(at('/portfolio/homelab', '#setup')).toEqual({ id: 'projects', read: '/portfolio/homelab/#setup' });
  });

  test('a section of the room page is a reading, an empty hash is not', () => {
    expect(at('/about/', '#focus')).toEqual({ id: 'about', read: '/about/#focus' });
    expect(at('/about/', '#')).toEqual({ id: 'about', read: null });
  });

  test('an unknown path is the lobby with nothing to read', () => {
    expect(at('/nowhere/at-all/')).toEqual({ id: 'lobby', read: null });
  });
});

describe('roomAt', () => {
  test('gives the room and the first part of the path', () => {
    expect(roomAt('/blog/my-homelab/')).toEqual(['writing', '/blog/']);
    expect(roomAt('/')).toEqual([null, '/']);
    expect(roomAt('/nowhere/')).toEqual([null, '/nowhere/']);
  });
});
