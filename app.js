'use strict';

const $ = id => document.getElementById(id);
const audio = $('audio');
const content = $('content');
const demos = [
  ['neon', 'Neonowe miasto', 'Nocne Fale'],
  ['horyzont', 'Horyzont', 'Solar Echo'],
  ['mgla', 'Po drugiej stronie mgły', 'Cicha Orbita'],
  ['puls', 'Puls', 'Velvet Circuit'],
].map(([id, title, artist]) => ({ id, title, artist, src: 'assets/' + id + '.mp3', art: 'assets/' + id + '.webp', duration: 32 }));

function restore(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

const likes = new Set(restore('zry-likes'));
let queue = restore('zry-queue');
let imports = [];
let current;
let view = 'home';
let renderedView;
let shuffle = false;
let noticeTimer;
const spotifyKinds = {track: 'Utwór', album: 'Album', playlist: 'Playlista', short: 'Link Spotify'};
const spotifyOrigin = 'https://open.spotify.com';
const useSpotifyEmbed = location.hostname !== 'appassets.androidplatform.net' &&
  !new URLSearchParams(location.search).has('externalSpotify');
const spotifyLibrary = restore('zry-spotify-links').flatMap(item => {
  const link = parseSpotifyLink(typeof item?.url === 'string' ? item.url : '');
  return link ? [{...link, title: typeof item.title === 'string' ? item.title.slice(0, 120) : ''}] : [];
});
const all = () => [...demos, ...imports];
const findTrack = id => all().find(track => track.id === id);
const format = seconds => Number.isFinite(seconds) ? Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0') : '–:––';

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    notify('Przeglądarka nie pozwala zapisać zmian.');
    return false;
  }
}

function notify(message) {
  $('notice').textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 3700);
}

function tag(name, className, value) {
  const item = document.createElement(name);
  if (className) item.className = className;
  if (value) item.textContent = value;
  return item;
}

function button(label, value, action) {
  const element = tag('button', '', value);
  element.type = 'button';
  element.setAttribute('aria-label', label);
  element.title = label;
  element.addEventListener('click', action);
  return element;
}

function paintArt(element, track) {
  element.style.backgroundImage = track.art ? 'url("' + track.art + '")' : '';
  element.textContent = track.art ? '' : '♫';
  element.setAttribute('aria-hidden', 'true');
}

function trackDetails(track) {
  const detail = tag('span');
  detail.append(tag('strong', '', track.title), tag('small', '', track.artist));
  return detail;
}

function toggleLike(id) {
  if (likes.has(id)) likes.delete(id);
  else likes.add(id);
  save('zry-likes', [...likes]);
  render();
}

function removeFromQueue(index) {
  queue.splice(index, 1);
  save('zry-queue', queue);
}

function showTracks(tracks, empty) {
  if (!tracks.length) {
    content.append(tag('p', 'empty', empty));
    return;
  }
  const rows = tag('div', 'tracks');
  tracks.forEach(({track, queueIndex}, index) => {
    const row = tag('div', 'track');
    if (current?.id === track.id) row.classList.add('selected');
    const name = button('Odtwórz ' + track.title, '', () => {
      if (queueIndex !== undefined) removeFromQueue(queueIndex);
      playTrack(track);
    });
    name.className = 'track-name';
    const art = tag('span', 'art');
    paintArt(art, track);
    name.append(art, trackDetails(track));
    const liked = likes.has(track.id);
    const heart = button((liked ? 'Usuń z ulubionych: ' : 'Dodaj do ulubionych: ') + track.title, liked ? '♥' : '♡', () => toggleLike(track.id));
    heart.setAttribute('aria-pressed', String(liked));
    if (liked) heart.classList.add('selected');
    const queued = button(queueIndex === undefined ? 'Dodaj do kolejki: ' + track.title : 'Usuń z kolejki: ' + track.title,
      queueIndex === undefined ? '＋' : '×', () => {
        if (queueIndex !== undefined) {
          removeFromQueue(queueIndex);
          render();
        } else {
          queue.push(track.id);
          save('zry-queue', queue);
          notify('Dodano do kolejki: ' + track.title);
        }
      });
    row.append(tag('span', 'number', String(index + 1)), name, heart, queued, tag('span', 'length', format(track.duration)));
    rows.append(row);
  });
  content.append(rows);
}

function parseSpotifyLink(value) {
  const uri = /^spotify:(track|album|playlist):([A-Za-z0-9]{22})$/.exec(value);
  let route = uri;
  if (!route) {
    let url;
    try { url = new URL(value); }
    catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname === 'spotify.link' && /^\/[A-Za-z0-9_-]{1,80}\/?$/.test(url.pathname)) {
      return {kind: 'short', url: url.origin + url.pathname.replace(/\/$/, '')};
    }
    if (url.origin !== spotifyOrigin) return null;
    route = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?(track|album|playlist)\/([A-Za-z0-9]{22})\/?$/i.exec(url.pathname);
    if (!route) return null;
  }
  const kind = route[1].toLowerCase();
  const id = route[2];
  return {kind, id, url: spotifyOrigin + '/' + kind + '/' + id};
}

function spotifyTitle(item) {
  return item.title || (item.id ? spotifyKinds[item.kind] + ' · ' + item.id : spotifyKinds.short + ' · ' + new URL(item.url).pathname.slice(1));
}

function renderSpotify() {
  const heading = tag('h2', '', 'Linki Spotify');
  const helper = tag('p', 'empty', 'Wklej linki do utworów, albumów lub playlist. Każdy link wpisz w osobnym wierszu.');
  const form = tag('form', 'spotify-form');
  const label = tag('label', '', 'Linki do Spotify');
  label.htmlFor = 'spotify-urls';
  const links = tag('textarea');
  links.id = 'spotify-urls';
  links.rows = 3;
  links.required = true;
  links.maxLength = 16000;
  links.placeholder = 'https://open.spotify.com/track/…';
  const titleLabel = tag('label', '', 'Nazwa (opcjonalnie, dla jednego linku)');
  titleLabel.htmlFor = 'spotify-title';
  const title = tag('input');
  title.id = 'spotify-title';
  title.maxLength = 120;
  const add = tag('button', 'primary', 'Dodaj do biblioteki');
  const feedback = tag('p', 'spotify-feedback');
  feedback.setAttribute('role', 'status');
  form.append(label, links, titleLabel, title, add, feedback);
  const results = tag('div', 'spotify-results');
  const player = tag('div', 'spotify-embed');

  function showLinks() {
    results.replaceChildren();
    if (!spotifyLibrary.length) {
      results.append(tag('p', 'empty', 'Zapisane linki pojawią się tutaj.'));
      return;
    }
    spotifyLibrary.forEach(item => {
      const row = tag('div', 'spotify-row');
      const info = tag('div');
      info.append(tag('strong', '', spotifyTitle(item)), tag('small', '', spotifyKinds[item.kind]));
      const open = tag('a', 'spotify-link', 'Otwórz w Spotify');
      open.href = item.url;
      if (useSpotifyEmbed) open.target = '_blank';
      open.rel = 'noopener noreferrer';
      row.append(info);
      if (useSpotifyEmbed && item.id) {
        const preview = button('Pokaż odtwarzacz Spotify: ' + spotifyTitle(item), '▶ Spotify', () => {
          audio.pause();
          const frame = tag('iframe');
          frame.title = 'Odtwarzacz Spotify – ' + spotifyTitle(item);
          frame.src = spotifyOrigin + '/embed/' + item.kind + '/' + item.id;
          frame.height = item.kind === 'track' ? '152' : '352';
          frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
          frame.allowFullscreen = true;
          player.replaceChildren(frame);
          player.dataset.url = item.url;
          player.scrollIntoView({block: 'nearest'});
        });
        row.append(preview);
      }
      row.append(open, button('Usuń z biblioteki: ' + spotifyTitle(item), '×', () => {
        spotifyLibrary.splice(spotifyLibrary.indexOf(item), 1);
        if (save('zry-spotify-links', spotifyLibrary)) feedback.textContent = 'Usunięto link.';
        if (player.dataset.url === item.url) {
          player.replaceChildren();
          delete player.dataset.url;
        }
        showLinks();
      }));
      results.append(row);
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const entries = links.value.trim().split(/\s+/).filter(Boolean);
    if (!entries.length) {
      feedback.textContent = 'Wklej co najmniej jeden link Spotify.';
      return;
    }
    const known = new Set(spotifyLibrary.map(item => item.url));
    const rejected = [];
    let added = 0;
    let duplicate = 0;
    entries.forEach(value => {
      const item = parseSpotifyLink(value);
      if (!item) { rejected.push(value); return; }
      if (known.has(item.url)) { duplicate++; return; }
      known.add(item.url);
      spotifyLibrary.push({...item, title: entries.length === 1 ? title.value.trim() : ''});
      added++;
    });
    const persisted = !added || save('zry-spotify-links', spotifyLibrary);
    feedback.textContent = [
      added && (persisted ? 'Zapisano: ' : 'Dodano w tej karcie: ') + added + '.',
      duplicate && 'Już w bibliotece: ' + duplicate + '.',
      rejected.length && 'Nieprawidłowe linki: ' + rejected.length + '.',
    ].filter(Boolean).join(' ');
    links.value = rejected.join('\n');
    if (!rejected.length) title.value = '';
    showLinks();
  });

  showLinks();
  content.append(heading, helper, form, player, results);
}

function render() {
  document.querySelectorAll('[data-view]').forEach(item => {
    const active = item.dataset.view === view;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  const liked = current && likes.has(current.id);
  $('like').disabled = !current;
  $('like').textContent = liked ? '♥' : '♡';
  $('like').setAttribute('aria-label', liked ? 'Usuń z ulubionych' : 'Dodaj do ulubionych');
  $('like').setAttribute('aria-pressed', String(Boolean(liked)));

  if (view === 'spotify' && renderedView === view) return;
  renderedView = view;
  content.replaceChildren();

  if (view === 'home') {
    const hero = tag('section', 'hero has-art');
    hero.innerHTML = '<div><p class="label">ZRYSPOTY MIX</p><h1>Włącz swój<br><span>klimat.</span></h1><p>Elektroniczne brzmienia na wieczór, noc i wszystko pomiędzy.</p></div>';
    const start = button('Odtwórz ZRYSPOTY Mix', '▶  Włącz miks', () => playTrack(demos[0]));
    start.className = 'primary';
    hero.firstElementChild.append(start);
    const cards = tag('div', 'cards');
    demos.forEach(track => {
      const card = button('Odtwórz ' + track.title, '', () => playTrack(track));
      card.className = 'card';
      const art = tag('span', 'art');
      paintArt(art, track);
      card.append(art, trackDetails(track));
      cards.append(card);
    });
    content.append(hero, tag('h2', '', 'Utwory demonstracyjne'), cards, tag('h2', '', 'Lista utworów'));
    showTracks(demos.map(track => ({track})));
    return;
  }

  if (view === 'spotify') {
    renderSpotify();
    return;
  }

  const titles = {search: 'Szukaj', likes: 'Ulubione', files: 'Moja muzyka', queue: 'Kolejka'};
  content.append(tag('h2', '', titles[view]));
  if (view === 'queue') {
    const tracks = queue.map((id, queueIndex) => ({track: findTrack(id), queueIndex})).filter(row => row.track);
    showTracks(tracks, 'Kolejka jest pusta. Użyj przycisku ＋ obok utworu, aby go dodać.');
    return;
  }

  const query = $('search').value.trim().toLocaleLowerCase('pl');
  const tracks = {
    search: () => all().filter(track => (track.title + ' ' + track.artist).toLocaleLowerCase('pl').includes(query)),
    likes: () => all().filter(track => likes.has(track.id)),
    files: () => imports,
  }[view]();
  const messages = {search: 'Nie znaleziono utworów.', likes: 'Kliknij serce obok utworu, aby zapisać go w ulubionych.', files: 'Kliknij „Dodaj muzykę”, aby zaimportować pliki audio.'};
  showTracks(tracks.map(track => ({track})), messages[view]);
  if (view === 'search') {
    const term = $('search').value.trim();
    const spotify = tag('a', 'spotify-link', term ? 'Wyszukaj w Spotify' : 'Otwórz Spotify');
    spotify.href = term ? 'https://open.spotify.com/search/' + encodeURIComponent(term) : 'https://open.spotify.com/';
    if (useSpotifyEmbed) spotify.target = '_blank';
    spotify.rel = 'noopener noreferrer';
    content.append(spotify);
  }
}

function navigate(target) {
  view = target;
  if (location.hash !== '#' + target) location.hash = target;
  render();
}

function syncView() {
  const target = location.hash.slice(1);
  if (target === view) return;
  view = ['home', 'search', 'likes', 'files', 'spotify', 'queue'].includes(target) ? target : 'home';
  render();
}

function resume() {
  audio.play().catch(error => {
    if (error.name !== 'AbortError') notify('Nie można odtworzyć tego pliku audio.');
  });
}

function playTrack(track) {
  current = track;
  audio.src = track.src;
  $('now-title').textContent = track.title;
  $('now-artist').textContent = track.artist;
  paintArt($('now-art'), track);
  syncTime();
  resume();
  render();
}

function advance(direction) {
  if (direction > 0 && queue.length) {
    let track;
    while (queue.length && !track) track = findTrack(queue.shift());
    save('zry-queue', queue);
    if (track) {
      playTrack(track);
      return;
    }
  }
  const tracks = current && imports.includes(current) ? imports : demos;
  const index = tracks.indexOf(current);
  const offset = shuffle && tracks.length > 1 ? 1 + Math.floor(Math.random() * (tracks.length - 1)) : direction;
  playTrack(tracks[index < 0 ? 0 : (index + offset + tracks.length) % tracks.length]);
}

function syncTime() {
  $('elapsed').textContent = format(audio.currentTime);
  $('duration').textContent = format(Number.isFinite(audio.duration) ? audio.duration : current?.duration ?? 0);
  $('seek').value = audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
}

function syncPlay() {
  $('play').textContent = audio.paused ? '▶' : 'Ⅱ';
  $('play').setAttribute('aria-label', audio.paused ? 'Odtwórz' : 'Wstrzymaj');
}

document.querySelectorAll('[data-view]').forEach(item => item.onclick = () => {
  navigate(item.dataset.view);
  if (view === 'search') $('search').focus();
});
window.addEventListener('hashchange', syncView);
$('search').addEventListener('input', () => navigate('search'));
$('queue-button').onclick = () => navigate('queue');
$('play').onclick = () => {
  if (!current) advance(1);
  else if (audio.paused) resume();
  else audio.pause();
};
$('like').onclick = () => { if (current) toggleLike(current.id); };
$('next').onclick = () => advance(1);
$('prev').onclick = () => {
  if (audio.currentTime > 3) audio.currentTime = 0;
  else advance(-1);
};
$('shuffle').onclick = () => $('shuffle').setAttribute('aria-pressed', String(shuffle = !shuffle));
$('repeat').onclick = () => $('repeat').setAttribute('aria-pressed', String(audio.loop = !audio.loop));
$('seek').oninput = () => {
  if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * Number($('seek').value) / 100;
};
audio.volume = Number($('volume').value);
$('volume').oninput = () => { audio.volume = Number($('volume').value); };
$('mute').onclick = () => {
  audio.muted = !audio.muted;
  $('mute').textContent = audio.muted ? '◖×' : '◖))';
  $('mute').setAttribute('aria-label', audio.muted ? 'Włącz dźwięk' : 'Wycisz');
};
['timeupdate', 'loadedmetadata', 'durationchange'].forEach(event => audio.addEventListener(event, syncTime));
['play', 'pause', 'ended'].forEach(event => audio.addEventListener(event, syncPlay));
audio.addEventListener('ended', () => advance(1));

function openLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('zryspoty', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('music', {keyPath: 'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function useLibrary(db, mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('music', mode);
    const request = action(transaction.objectStore('music'));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

function addImport({id, file}) {
  const track = {id, title: file.name.replace(/\.[^.]+$/, '') || file.name, artist: 'Moja muzyka', src: URL.createObjectURL(file)};
  imports.push(track);
  const metadata = new Audio();
  metadata.preload = 'metadata';
  const release = () => {
    metadata.removeAttribute('src');
    metadata.load();
  };
  metadata.onloadedmetadata = () => {
    track.duration = metadata.duration;
    release();
    if (view !== 'home') render();
  };
  metadata.onerror = release;
  metadata.src = track.src;
}

const library = openLibrary().then(async db => {
  const records = await useLibrary(db, 'readonly', store => store.getAll());
  records.forEach(addImport);
  render();
  return db;
}).catch(() => null);

$('files').addEventListener('change', async event => {
  const files = [...event.target.files].filter(file => file.size && (file.type.startsWith('audio/') || /\.(mp3|m4a|flac|ogg|wav|aac|opus)$/i.test(file.name)));
  event.target.value = '';
  if (!files.length) return;
  const records = files.map(file => ({id: 'local-' + Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''), file}));
  const db = await library;
  try {
    if (!db) throw new Error('Brak bazy lokalnej');
    await useLibrary(db, 'readwrite', store => records.forEach(record => store.put(record)));
    notify('Zapisano pliki w bibliotece.');
  } catch {
    notify('Pliki są dostępne do zamknięcia tej karty.');
  }
  records.forEach(addImport);
  navigate('files');
});

syncView();
render();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && location.hostname !== 'appassets.androidplatform.net') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
