const express = require('express');
const { chromium } = require('playwright');
const { firefox } = require('playwright'); // Import pour getStreamURL

const app = express();
const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN || '';

function authMiddleware(req, res, next) {
    if (!API_TOKEN) return next();
    let authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
    }
    let token = authHeader.slice(7);
    if (token !== API_TOKEN) {
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
    next();
}

async function searchAudiomack(query, limit = 20) {
    try {
        let browser = await chromium.launch({ headless: true });
        let page = await browser.newPage();

        return new Promise(async (resolve) => {
            let timeoutId = null;

            async function cleanupAndResolve(value) {
                clearTimeout(timeoutId);
                await browser.close();

                if (value?.results?.length) {
                    return resolve(value.results
                        .map(track => track && ({
                            title: `${track.artist} - ${track.title}`,
                            duration: track.duration,
                            thumbnail: track.image_base || track.image,
                            url: track.links?.self || `https://audiomack.com/${track.uploader_url_slug}/song/${track.url_slug}`
                        }))
                        .filter(Boolean)
                        .slice(0, limit));
                }

                resolve(null);
            }

            page.on('response', async (response) => {
                let url = response.url();

                if (url.includes('api.audiomack.com/v1/search')) {
                    try {
                        let json = await response.json();
                        await cleanupAndResolve(json);
                    } catch (e) {
                        await cleanupAndResolve(null);
                    }
                }
            });

            await page.goto(`https://audiomack.com/search?q=${encodeURIComponent(query)}`, {
                waitUntil: 'domcontentloaded'
            });

            timeoutId = setTimeout(async () => {
                await cleanupAndResolve(null);
            }, 10000);
        });
    } catch (e) {
        console.error("[audiomack.js] Error searching audiomack songs", e);
        return null;
    }
}

// ➕ Nouvelle fonction pour récupérer le lien de stream
async function getStreamURL(trackUrl) {
    let browser = await firefox.launch({ headless: false });
    let page = await browser.newPage();
    let timeoutId = null;
    let browserClosed = false;

    return new Promise(async (resolve) => {
        async function cleanupAndResolve(value) {
            if (!browserClosed) {
                browserClosed = true;
                clearTimeout(timeoutId);
                await browser.close().catch(() => { });
            }
            resolve(value);
        }

        page.on('requestfinished', async (request) => {
            if (browserClosed) return;
            let url = request.url();
            if (url.includes('music.audiomack.com')) {
                console.log('Found audio URL:', url);
                await cleanupAndResolve(url);
            }
        });

        try {
            await page.goto(trackUrl, { waitUntil: 'domcontentloaded' });
        } catch (e) {
            console.error('Error on page.goto():', e);
            await cleanupAndResolve(null);
            return;
        }

        try {
            const playButton = await page.waitForSelector('button[data-amlabs-play-button="true"]', { timeout: 10000 });
            try {
                await playButton.click({ timeout: 3000 });
            } catch (clickErr) {
                console.warn('Play button found but not clickable:', clickErr);
                await cleanupAndResolve(null);
                return;
            }
        } catch (e) {
            console.warn('Play button not found:', e);
            await cleanupAndResolve(null);
            return;
        }

        timeoutId = setTimeout(async () => {
            console.warn('Timeout waiting for audio request.');
            await cleanupAndResolve(null);
        }, 100000);
    });
}

// 🔍 Recherche
app.get('/search', authMiddleware, async (req, res) => {
    let { query, limit } = req.query;
    if (!query) return res.status(400).json({ error: 'Missing query parameter' });

    let limitNum = Number(limit) || 20;
    let results = await searchAudiomack(query, limitNum);

    if (!results) return res.status(500).json({ error: 'Search failed or no results' });

    res.json({ success: true, results });
});

// 🔊 Récupération de l'URL de stream
app.get('/stream', authMiddleware, async (req, res) => {
    let { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    let streamUrl = await getStreamURL(url);

    if (!streamUrl) return res.status(500).json({ error: 'Failed to get stream URL' });

    res.json({ success: true, streamUrl });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
