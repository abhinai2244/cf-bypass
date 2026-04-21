import express, { Request, Response } from 'express';
import turnstile from './lib/ends/turnstile';
import iuam from './lib/ends/iuam';
import { connect } from "./lib/browser/br";

const app = express();
const port = process.env.PORT || 8742;
const authToken = process.env.authToken || null;

(global as any).browserLimit = Number(process.env.browserLimit) || 20;
(global as any).timeOut = Number(process.env.timeOut) || 60000;

const CACHE_TTL = 30 * 60 * 1000;

interface CacheEntry {
    expireAt: number;
    value: any;
}

interface Cache {
    [key: string]: CacheEntry;
}

const memoryCache: Cache = {};

async function readCache(key: string): Promise<any> {
    const entry = memoryCache[key];
    if (entry && Date.now() < entry.expireAt) {
        return entry.value;
    }
    return null;
}

async function writeCache(key: string, value: any, ttl: number = CACHE_TTL) {
    memoryCache[key] = { expireAt: Date.now() + ttl, value };
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'development') {
    let server = app.listen(port, async () => {
        console.log(`Server running on port ${port}`);
    });
    try {
        server.timeout = (global as any).timeOut;
    } catch { }
}

let browser: any = null;

async function initBrowser() {
    if (browser) return browser;

    try {
        const { browser: connectedBrowser } = await connect({
            headless: false,
            turnstile: true,
            connectOption: { defaultViewport: null },
            disableXvfb: false,
        });

        browser = connectedBrowser;

        browser.on('disconnected', () => {
            console.log('Browser disconnected');
            browser = null;
        });

        return browser;
    } catch (error) {
        console.error('Failed to initialize browser:', error);
        throw error;
    }
}

initBrowser().then(() => console.log("Browser initialized")).catch(err => console.error("Initial browser launch failed", err));


async function getPage() {
    if (!browser || !browser.isConnected()) {
        await initBrowser();
    }

    if (!browser) {
        throw new Error("Browser not available");
    }

    const page = await browser.newPage();

    await page.goto('about:blank');
    await page.setRequestInterception(true);
    page.on('request', async (req: any) => {
        const type = req.resourceType();
        if (["image", "stylesheet", "font", "media"].includes(type)) {
            await req.abort();
        } else {
            await req.continue();
        }
    });

    return page;
}

app.post('/cloudflare', async (req: Request, res: Response): Promise<any> => {
    const startTime = Date.now();
    const data = req.body;
    if (!data || typeof data.mode !== 'string') {
        return res.status(400).json({ message: 'Bad Request: missing or invalid mode' });
    }
    if (authToken && data.authToken !== authToken) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if ((global as any).browserLimit <= 0) {
        return res.status(429).json({ message: 'Too Many Requests' });
    }

    let cacheKey: string = "", cached;
    if (data.mode === "iuam") {
        cacheKey = JSON.stringify(data);
        cached = await readCache(cacheKey);
        if (cached) {
            return res.status(200).json({ ...cached, cached: true, elapsed: ((Date.now() - startTime) / 1000).toFixed(2) + 's' });
        }
    }

    (global as any).browserLimit--;
    let result: any;
    let page;

    try {
        page = await getPage();

        switch (data.mode) {
            case "turnstile":
                result = await turnstile(data as any, page)
                    .then(token => ({ token }))
                    .catch(err => ({ code: 500, message: err.message }));
                break;

            case "iuam":
                result = await iuam(data as any, page)
                    .then(r => ({ ...r }))
                    .catch(err => ({ code: 500, message: err.message }));

                if (!result.code || result.code === 200) {
                    const ttl = Number(data.ttl || data.expire) || CACHE_TTL;
                    await writeCache(cacheKey, result, ttl);
                }
                break;

            default:
                result = { code: 400, message: 'Invalid mode' };
        }
    } catch (err: any) {
        result = { code: 500, message: err.message };
    } finally {
        if (page) {
            try { await page.close(); } catch { }
        }
        (global as any).browserLimit++;
    }

    if (!result.elapsed) {
        result.elapsed = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
    }
    res.status(result.code ?? 200).json(result);
});

app.use(async (req: Request, res: Response) => {
    res.status(404).json({ message: 'Not Found' });
});

export default app;
