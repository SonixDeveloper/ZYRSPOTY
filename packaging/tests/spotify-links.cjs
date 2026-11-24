const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');

const src = readFileSync('app.js', 'utf8');
const parser = src.slice(src.indexOf('function parseSpotifyLink('), src.indexOf('function spotifyTitle('));
const origin = 'https://open.spotify.com';
const parse = runInNewContext(parser + '\nparseSpotifyLink', {URL, spotifyOrigin: origin});
const id = '4uLU6hMCjMI75M1A2tKUQC';
for (const kind of ['track', 'album', 'playlist']) {
    for (const value of [
        `${origin}/${kind}/${id}?si=sharing`,
        `${origin}/intl-pl/${kind}/${id}/`,
        `${origin}/embed/${kind}/${id}`,
        `spotify:${kind}:${id}`,
    ]) {
        const item = parse(value);
        assert.equal(item.kind, kind);
        assert.equal(item.id, id);
        assert.equal(item.url, `${origin}/${kind}/${id}`);
    }
}
assert.equal(parse('https://spotify.link/Abc123?si=sharing').url, 'https://spotify.link/Abc123');
for (const value of [
    '', 'https://example.com/track/' + id, 'https://open.spotify.com.evil.test/track/' + id,
    'http://open.spotify.com/track/' + id, 'https://user@open.spotify.com/track/' + id,
    'https://open.spotify.com/track/short', 'javascript:alert(1)',
]) assert.equal(parse(value), null);
console.log('Spotify link parsing passed');
