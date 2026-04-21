const fs = require('fs');
const path = require('path');

interface TurnstileData {
    domain: string;
    siteKey: string;
    proxy?: {
        username?: string;
        password?: string;
    };
}

async function turnstile({ domain, proxy, siteKey }: TurnstileData, page: any) {
    if (!domain) throw new Error("Missing domain parameter");
    if (!siteKey) throw new Error("Missing siteKey parameter");

    const timeout = (global as any).timeOut || 60000;
    let isResolved = false;

    const cl = setTimeout(async () => {
        if (!isResolved) {
            throw new Error("Timeout Error");
        }
    }, timeout);

    try {
        if (proxy?.username && proxy?.password) {
            await page.authenticate({
                username: proxy.username,
                password: proxy.password,
            });
        }

        const htmlContent = `
        <div class="turnstile"></div>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback" defer></script>
        <script>
          window.onloadTurnstileCallback = function () {
            turnstile.render('.turnstile', {
              sitekey: '${siteKey}',
              callback: function (token) {
                var c = document.createElement('input');
                c.type = 'hidden';
                c.name = 'cf-response';
                c.value = token;
                document.body.appendChild(c);
              },
            });
          };
        </script>
    `;

        await page.setRequestInterception(true);
        page.removeAllListeners("request");
        page.on("request", async (request: any) => {
            const reqUrl = request.url();
            if ([domain, domain + "/"].includes(reqUrl) && request.resourceType() === "document") {
                await request.respond({
                    status: 200,
                    contentType: "text/html",
                    body: htmlContent,
                });
            } else if (reqUrl.includes("challenges.cloudflare.com/reports/v0/post")) {
                await request.abort();
            } else if (reqUrl.includes("challenges.cloudflare.com/turnstile/v0/b/88d68f5d5ea3/api.js")) {
                const localPath = path.join(__dirname, '../js/api.js');
                try {
                    const body = fs.readFileSync(localPath);
                    await request.respond({
                        status: 200,
                        contentType: 'application/javascript',
                        body: body
                    });
                } catch (e) {
                    console.error("Failed to serve local api.js:", e);
                    await request.continue();
                }
            } else if (
                reqUrl.includes("challenges.cloudflare.com") ||
                reqUrl.includes("/cdn-cgi/challenge-platform/")
            ) {
                await request.continue();
            } else {
                await request.abort();
            }
        });

        await page.goto(domain, { waitUntil: "domcontentloaded" });

        await page.waitForSelector('[name="cf-response"]', { timeout });

        const token = await page.evaluate(() => {
            try {
                return document.querySelector('[name="cf-response"]')?.getAttribute('value');
            } catch {
                return null;
            }
        });

        isResolved = true;
        clearTimeout(cl);

        if (!token || token.length < 10) throw new Error("Failed to get token");
        return token;

    } catch (e) {
        clearTimeout(cl);
        throw e;
    }
}

export = turnstile;
