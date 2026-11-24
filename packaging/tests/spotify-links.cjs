const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');

const src = readFileSync('app.js', 'utf8');
const parser = src.slice(src.indexOf('function parseSpotifyLink('), src.indexOf('function musicTitle('));
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

const youtube = runInNewContext(parser + '\nparseYouTubeLink', {URL});
const video = 'aB1-cD2_eF3';
for (const value of [
    'https://youtu.be/' + video + '?si=tracking',
    'https://www.youtube.com/watch?v=' + video,
    'https://m.youtube.com/shorts/' + video,
    'https://youtube.com/live/' + video,
    'https://music.youtube.com/watch?v=' + video + '&list=RDMIX',
]) {
    const item = youtube(value);
    assert.equal(item.kind, 'video');
    assert.equal(item.key, 'youtube:video:' + video);
}
assert.equal(youtube('https://music.youtube.com/watch?v=' + video).service, 'YouTube Music');
assert.equal(youtube('https://music.youtube.com/playlist?list=PL_1').kind, 'playlist');
assert.equal(youtube('https://www.youtube.com.evil.test/watch?v=' + video), null);
assert.equal(youtube('https://music.youtube.com/watch?v=invalid'), null);
assert.equal(youtube('https://www.youtube.com/@artist'), null);
console.log('YouTube and YouTube Music link parsing passed');

const parseMusic = runInNewContext(parser + '\nparseMusicLink', {URL, spotifyOrigin: origin});
assert.equal(parseMusic(origin + '/track/' + id).service, 'Spotify');
assert.equal(parseMusic('https://youtu.be/' + video).url, 'https://www.youtube.com/watch?v=' + video);
const embedSource = src.slice(src.indexOf('function musicEmbed('), src.indexOf('function renderMusicLinks('));
const item = parseMusic('https://music.youtube.com/watch?v=' + video);
const embedFor = (androidApp, webYouTubeEmbed, useSpotifyEmbed) =>
    runInNewContext(embedSource + '\nmusicEmbed', {androidApp, webYouTubeEmbed, useSpotifyEmbed, spotifyOrigin: origin});
assert.equal(embedFor(true, true, false)(item), 'https://pl.zryspoty.player/youtube.html?v=' + video);
assert.equal(embedFor(false, true, true)(item), 'https://www.youtube.com/embed/' + video + '?playsinline=1');
assert.equal(embedFor(false, false, true)(item), null);
