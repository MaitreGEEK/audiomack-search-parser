const express = require('express');
const { firefox } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

// Get API token from env, empty disables auth
const API_TOKEN = process.env.API_TOKEN || '';

// Middleware to check Bearer token only if API_TOKEN is set
function authMiddleware(req, res, next) {
    if (!API_TOKEN) {
        // No token set, skip auth
        return next();
    }

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

// Audiomack search function
async function searchAudiomack(query, limit = 20) {
    try {
        let browser = await firefox.launch({ headless: true });
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

// Protected route, conditionally protected
app.get('/search', authMiddleware, async (req, res) => {
    let { query, limit } = req.query;
    if (!query) return res.status(400).json({ error: 'Missing query parameter' });

    let limitNum = Number(limit) || 20;

    let results = await searchAudiomack(query, limitNum);

    if (!results) return res.status(500).json({ error: 'Search failed or no results' });

    res.json({ results });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
