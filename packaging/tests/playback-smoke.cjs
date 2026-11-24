const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {resolve} = require('node:path');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        let referer;
        await page.route('https://www.youtube.com/embed/**', async route => {
            referer = (await route.request().allHeaders()).referer;
            await route.fulfill({contentType: 'text/html', body: '<button>Play YouTube</button>'});
        });
        await page.route('https://open.spotify.com/embed/**', route =>
            route.fulfill({contentType: 'text/html', body: '<button>Play Spotify</button>'}));
        await page.goto(pathToFileURL(resolve(process.argv[2])).href + '#spotify');
        const links = page.getByLabel('Linki do utworów lub playlist');
        const submit = page.getByRole('button', {name: 'Dodaj do biblioteki'});
        await links.fill('https://youtu.be/aB1-cD2_eF3');
        await submit.click();
        await page.getByRole('button', {name: /Pokaż odtwarzacz: Utwór/}).click();
        const youtube = page.frameLocator('iframe[title^="Odtwarzacz YouTube"]').frameLocator('iframe');
        await youtube.getByRole('button', {name: 'Play YouTube'}).waitFor();
        assert.equal(referer, 'http://127.0.0.1:42682/');
        await page.getByRole('button', {name: 'Zamknij odtwarzacz'}).click();
        await links.fill('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
        await submit.click();
        await page.getByRole('button', {name: /Pokaż odtwarzacz: Utwór · 4uLU/}).click();
        await page.frameLocator('iframe[title^="Odtwarzacz Spotify"]').getByRole('button', {name: 'Play Spotify'}).waitFor();
        await page.getByRole('button', {name: 'Załaduj ponownie odtwarzacz'}).click();
        await page.frameLocator('iframe[title^="Odtwarzacz Spotify"]').getByRole('button', {name: 'Play Spotify'}).waitFor();
        assert.equal(await page.locator('.linked-actions a').getAttribute('href'), 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
        console.log('Browser opened, both provider frames loaded, retry and external link passed.');
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
