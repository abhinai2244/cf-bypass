import { Browser, Page } from 'rebrowser-puppeteer-core';
import { createCursor, GhostCursor } from 'ghost-cursor';
import kill from 'tree-kill';

async function checkTurnstile({ page }: { page: Page }): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
        var waitInterval = setTimeout(() => { clearTimeout(waitInterval); resolve(false) }, 5000);
        try {
            const elements = await page.$$('[name="cf-turnstile-response"]');
            if (elements.length <= 0) {

                const coordinates = await page.evaluate(() => {
                    let coordinates: any = [];
                    document.querySelectorAll('div').forEach(item => {
                        try {
                            let itemCoordinates = item.getBoundingClientRect()
                            let itemCss = window.getComputedStyle(item)
                            if (itemCss.margin == "0px" && itemCss.padding == "0px" && itemCoordinates.width > 290 && itemCoordinates.width <= 310 && !item.querySelector('*')) {
                                coordinates.push({ x: itemCoordinates.x, y: item.getBoundingClientRect().y, w: item.getBoundingClientRect().width, h: item.getBoundingClientRect().height })
                            }
                        } catch (err) { }
                    });

                    if (coordinates.length <= 0) {
                        document.querySelectorAll('div').forEach(item => {
                            try {
                                let itemCoordinates = item.getBoundingClientRect()
                                if (itemCoordinates.width > 290 && itemCoordinates.width <= 310 && !item.querySelector('*')) {
                                    coordinates.push({ x: itemCoordinates.x, y: item.getBoundingClientRect().y, w: item.getBoundingClientRect().width, h: item.getBoundingClientRect().height })
                                }
                            } catch (err) { }
                        });

                    }

                    return coordinates
                })

                for (const item of coordinates) {
                    try {
                        let x = item.x + 30;
                        let y = item.y + item.h / 2;
                        await page.mouse.click(x, y);
                    } catch (err) { }
                }
                return resolve(true)
            }

            for (const element of elements) {
                try {
                    const parentElement = await element.evaluateHandle((el: any) => el.parentElement);
                    const box = await (parentElement as any).boundingBox();
                    if (box) {
                        let x = box.x + 30;
                        let y = box.y + box.height / 2;
                        await page.mouse.click(x, y);
                    }
                } catch (err) { }
            }
            clearTimeout(waitInterval)
            resolve(true)
        } catch (err) {
            clearTimeout(waitInterval)
            resolve(false)
        }
    })
}

interface PageControllerOptions {
    browser: Browser;
    page: Page & { realCursor?: GhostCursor; realClick?: GhostCursor["click"] };
    proxy: any;
    turnstile: boolean;
    xvfbsession: any;
    pid: number;
    plugins: any[];
    killProcess?: boolean;
    chrome?: any;
}

async function pageController({ browser, page, proxy, turnstile, xvfbsession, pid, plugins, killProcess = false, chrome }: PageControllerOptions) {

    let solveStatus = turnstile

    page.on('close', () => {
        solveStatus = false
    });


    browser.on('disconnected', async () => {
        solveStatus = false
        if (killProcess === true) {
            if (xvfbsession) try { xvfbsession.stopSync() } catch (err) { }
            if (chrome) try { chrome.kill() } catch (err) { console.log(err); }
            if (pid) try { kill(pid, 'SIGKILL', () => { }) } catch (err) { }
        }
    });

    async function turnstileSolver() {
        while (solveStatus) {
            await checkTurnstile({ page }).catch(() => { });
            await new Promise(r => setTimeout(r, 1000));
        }
        return
    }

    turnstileSolver()

    if (proxy.username && proxy.password) await page.authenticate({ username: proxy.username, password: proxy.password });

    if (plugins.length > 0) {
        for (const plugin of plugins) {
            plugin.onPageCreated(page)
        }
    }

    const cursor = createCursor(page);
    page.realCursor = cursor
    page.realClick = cursor.click

    return page
}

export interface PageWithCursor extends Page {
    realClick: GhostCursor["click"];
    realCursor: GhostCursor;
}

export interface ProxyOptions {
    host: string;
    port: number;
    username?: string;
    password?: string;
}

export interface Options {
    args?: string[];
    headless?: boolean | "auto";
    customConfig?: import("chrome-launcher").Options;
    proxy?: ProxyOptions;
    turnstile?: boolean;
    connectOption?: import("rebrowser-puppeteer-core").ConnectOptions;
    disableXvfb?: boolean;
    plugins?: import("puppeteer-extra").PuppeteerExtraPlugin[];
    ignoreAllFlags?: boolean;
}

export interface ConnectResult {
    browser: Browser;
    page: PageWithCursor;
}

export async function connect({
    args = [],
    headless = false,
    customConfig = {},
    proxy = {} as ProxyOptions,
    turnstile = false,
    connectOption = {},
    disableXvfb = false,
    plugins = [],
    ignoreAllFlags = false,
}: Options = {}): Promise<ConnectResult> {
    const { launch, Launcher } = await import("chrome-launcher");

    let Xvfb: any;
    try {
        Xvfb = require("xvfb");
    } catch {

    }

    let puppeteer = require("rebrowser-puppeteer-core");

    let xvfbsession: any = null;
    if (headless == "auto") headless = false;

    if (process.platform === "linux" && disableXvfb === false) {
        try {
            xvfbsession = new Xvfb({
                silent: true,
                xvfb_args: ["-screen", "0", "1920x1080x24", "-ac"],
            });
            xvfbsession.startSync();
        } catch (err: any) {
            console.log(
                "You are running on a Linux platform but do not have xvfb installed. The browser can be captured. Please install it with the following command\n\nsudo apt-get install xvfb\n\n" +
                err.message
            );
        }
    }

    let chromeFlags: string[];
    if (ignoreAllFlags === true) {
        chromeFlags = [
            ...args,
            ...(headless !== false ? [`--headless=${headless}`] : []),
            ...(proxy && proxy.host && proxy.port
                ? [`--proxy-server=${proxy.host}:${proxy.port}`]
                : []),
        ];
    } else {

        const flags = Launcher.defaultFlags();

        const indexDisableFeatures = flags.findIndex((flag) => flag.startsWith('--disable-features'));
        if (indexDisableFeatures !== -1) {
            flags[indexDisableFeatures] = `${flags[indexDisableFeatures]},AutomationControlled`;
        }

        const indexComponentUpdateFlag = flags.findIndex((flag) => flag.startsWith('--disable-component-update'));
        if (indexComponentUpdateFlag !== -1) {
            flags.splice(indexComponentUpdateFlag, 1);
        }
        chromeFlags = [
            ...flags,
            ...args,
            ...(headless !== false ? [`--headless=${headless}`] : []),
            ...(proxy && proxy.host && proxy.port
                ? [`--proxy-server=${proxy.host}:${proxy.port}`]
                : []),
            "--no-sandbox",
            "--disable-dev-shm-usage",
        ];
    }
    const chrome = await launch({
        ignoreDefaultFlags: true,
        chromeFlags,
        ...customConfig,
    });

    if (plugins && plugins.length > 0) {
        const { addExtra } = await import("puppeteer-extra");

        puppeteer = addExtra(puppeteer);

        for (const item of plugins) {
            puppeteer.use(item);
        }
    }

    const browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${chrome.port}`,
        ...connectOption,
    });

    let [page] = await browser.pages();

    let pageControllerConfig = {
        browser,
        page,
        proxy,
        turnstile,
        xvfbsession,
        pid: chrome.pid,
        plugins: plugins || [],
    };

    page = await pageController({
        ...pageControllerConfig,
        killProcess: true,
        chrome,
    });

    browser.on("targetcreated", async (target: any) => {
        if (target.type() === "page") {
            let newPage = await target.page();
            pageControllerConfig.page = newPage;
            newPage = await pageController(pageControllerConfig);
        }
    });

    return {
        browser,
        page,
    };
}
