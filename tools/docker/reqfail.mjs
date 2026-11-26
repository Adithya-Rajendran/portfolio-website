// The one failed request a check may ignore: an aborted room-texture download.
export const streamAbort = (r) => r.failure()?.errorText === 'net::ERR_ABORTED' && /^\/assets\/[^/]+\/tex\/[^/]+\.ktx2$/.test(new URL(r.url()).pathname);
