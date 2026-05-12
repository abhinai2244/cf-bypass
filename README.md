# 🚀 CANTARELLA-Bypass: The Ultimate Cloudflare & Turnstile Solver

![Performance Benchmark](.github/benchmark.png)

### 🎥 Live Demo

<video src=".github/demo.mp4" controls="controls" style="max-width: 100%;">
  Your browser does not support the video tag.
</video>

> [!IMPORTANT]
> **NEED SUPPORT OR CUSTOM FEATURES?**
> 📩 **Contact :** [ CANTARELLA ](https://t.me/cantarella_wuwa)
> *We take requests! Message us for custom integrations.*

## 🔥 Why Is This The Fastest API?

Unlike generic solvers (FlareSolverr, Selenium), **CANTARELLABOTS-Bypass** is engineered for **speed** and **stealth**.

| Feature | CANTARELLA-Bypass | Others | Why It Matters |
| :--- | :--- | :--- | :--- |
| **Runtime** | **Bun** (Zig-based) | Node.js | **3x Faster** startup & execution times. |
| **Browser** | **Rebrowser-Puppeteer** | Standard Puppeteer | **Undetectable** by modern bot protection. |
| **Stealth** | **Ghost Cursor** | None / Basic | Simulates **REAL** human mouse movements. |
| **Efficiency** | **Smart Blocking** | Loads Everything | Blocks ads/media/fonts to save bandwidth. |
| **Display** | **Xvfb (Headless)** | Full GUI | Zero overhead, runs efficiently on VPS/Docker. |
| **Caching** | **In-Memory TTL** | No Caching | Instant results for repeated domains (0.04s). |

---

## ⚡ Deployment

### Option 1: Docker (Recommended)

Run it on any VPS in seconds.

```bash
# Build the image
docker build -t CANTARELLA-bypass .

# Run the container (detached, port 3000)
docker run -d -p 3000:3000 --name cantarella-bypass cantarella-bypass
```

### Option 2: Local (Bun)

Requires [Bun](https://bun.sh/) installed.

```bash
# Install dependencies
bun install

# Start the server
bun start
```

---

## 🛠 API Documentation

### Endpoint: `/cloudflare`
**Method:** `POST`
**Headers:** `Content-Type: application/json`

### Mode 1: Bypass IUAM (Under Attack Mode)

Use this for standard Cloudflare "Checking your browser" pages.

**Request Body:**
```json
{
    "mode": "iuam",
    "domain": "https://target-website.com",
    "proxy": {
        "username": "user",  // Optional
        "password": "pass"   // Optional
    },
    "ttl": 60000 // Cache this result for 60 seconds (Default: 30 mins)
}
```

> **Note:** Use `domain` parameter, NOT `url`.

**Response (Success):**
```json
{
    "code": 200,
    "cf_clearance": "content-of-cf-clearance-cookie...",
    "user_agent": "Mozilla/5.0 ...",
    "cookies": [...], 
    "elapsed": "0.82s",
    "cached": false
}
```

### Mode 2: Bypass Turnstile (Captcha)

Use this when you see the Cloudflare Turnstile widget.

**Request Body:**
```json
{
    "mode": "turnstile",
    "domain": "https://target-website.com",
    "siteKey": "0x4AAAAAA...",
    "proxy": { ... } // Optional
}
```

**Response (Success):**
```json
{
    "code": 200,
    "token": "0.X_TOKEN_HERE...",
    "elapsed": "1.45s"
}
```

---

## 📸 Performance Preview

Check the benchmark image above. We consistently outperform standard tools by **removing bloat** and **optimizing the browser fingerprint**.

*   **Average Solves:** ~1-3 seconds
*   **Cached Solves:** ~0.02 seconds

![Status of Test](.github/status_of_test.jpg)

---

> [!TIP]
> **STAY UPDATED**
> New bypass methods are pushed regularly.
> 🔗 **Channel:** [CANTARELLABOTS](https://t.me/cantarellabots)

