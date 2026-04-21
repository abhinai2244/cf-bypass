const fs = require('fs');
const path = require('path');

interface CloudflareData {
    domain: string;
    proxy?: {
        username?: string;
        password?: string;
    };
}

async function cloudflare(data: CloudflareData, page: any): Promise<any> {

    return new Promise(async (resolve, reject) => {
        if (!data.domain) return reject(new Error("Missing domain parameter"));

        const startTime = Date.now();
        let isResolved = false;
        const timeout = (global as any).timeOut || 60000;

        const cl = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                reject(new Error("Timeout Error"));
            }
        }, timeout);

        try {
            if (data.proxy?.username && data.proxy?.password) {
                await page.authenticate({
                    username: data.proxy.username,
                    password: data.proxy.password,
                });
            }

            page.removeAllListeners("request");
            page.removeAllListeners("response");
            await page.setRequestInterception(true);

            page.on("request", async (req: any) => {
                try {
                    const reqUrl = req.url();
                    if (reqUrl.includes("challenges.cloudflare.com/turnstile/v0/b/88d68f5d5ea3/api.js")) {
                        const localPath = path.join(__dirname, '../js/api.js');
                        try {
                            const body = fs.readFileSync(localPath);
                            await req.respond({
                                status: 200,
                                contentType: 'application/javascript',
                                body: body,
                                headers: {
                                    'Access-Control-Allow-Origin': '*'
                                }
                            });
                        } catch (e) {
                            console.error("Failed to serve local api.js:", e);
                            await req.continue();
                        }
                    } else if (
                        reqUrl === data.domain ||
                        reqUrl.includes("challenges.cloudflare.com") ||
                        reqUrl.includes("/cdn-cgi/challenge-platform/")
                    ) {
                        await req.continue();
                    } else {
                        await req.abort();
                    }
                } catch (_) { }
            });

            page.on("response", async (res: any) => {
                try {
                    const url = res.url();
                    if (url.includes("/cdn-cgi/challenge-platform/")) {
                        const headers = res.headers();
                        if (headers["set-cookie"]) {
                            const match = headers["set-cookie"].match(/cf_clearance=([^;]+)/);
                            if (match) {
                                const cf_clearance = match[1];
                                const userAgent = (await res.request().headers())["user-agent"];
                                const elapsedTime = (Date.now() - startTime) / 1000;

                                if (!isResolved) {
                                    isResolved = true;
                                    clearTimeout(cl);

                                    resolve({
                                        cf_clearance,
                                        user_agent: userAgent,
                                        elapsed: elapsedTime.toFixed(2) + 's',
                                    });
                                }
                            }
                        }
                    }
                } catch (_) { }
            });

            await page.goto(data.domain, { waitUntil: "domcontentloaded" });
        } catch (err) {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(cl);
                reject(err);
            }
        }
    });
}

export = cloudflare;
