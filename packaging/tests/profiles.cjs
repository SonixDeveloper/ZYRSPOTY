const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');

const src = readFileSync('app.js', 'utf8');
const extract = src.slice(src.indexOf('const profilesStorageKey'), src.indexOf('const profileState ='));
const storage = new Map();
const profile = runInNewContext(extract + '\n({readProfiles, addProfile, cleanProfileName, profileScope})', {
    localStorage: {getItem: key => storage.get(key) ?? null},
});
const guest = profile.readProfiles();
assert.equal(profile.profileScope(guest), '');
assert.equal(profile.cleanProfileName('  Ola   Żółć  '), 'Ola Żółć');
const first = profile.addProfile(guest, 'Ola', 'a'.repeat(32));
assert.equal(profile.profileScope(first), '', 'The first profile keeps the original library');
assert.equal(profile.profileScope({...first, active: null}), 'guest');
assert.equal(profile.addProfile(first, 'OLA', 'b'.repeat(32)), null);
const second = profile.addProfile(first, 'Igor', 'b'.repeat(32));
assert.equal(profile.profileScope(second), 'b'.repeat(32));
assert.equal(profile.profileScope({...second, active: first.active}), '');
storage.set('zry-profiles', JSON.stringify(second));
assert.equal(profile.readProfiles().active, second.active);
storage.set('zry-profiles', '{broken');
assert.equal(profile.profileScope(profile.readProfiles()), '');
console.log('Local profiles and existing library migration passed');
