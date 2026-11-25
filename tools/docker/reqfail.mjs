// Failed requests a check may ignore (task O7): the room loader aborts the texture-layer downloads still under way when
// a room is left. Only an abort, and only of a room texture (/assets/<room>/tex/*.ktx2); any other failure, and any HTTP
// error status on those files, still counts.
export const streamAbort = (r) => r.failure()?.errorText === 'net::ERR_ABORTED' && /^\/assets\/[^/]+\/tex\/[^/]+\.ktx2$/.test(new URL(r.url()).pathname);
