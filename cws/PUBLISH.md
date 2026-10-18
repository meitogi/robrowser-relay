# Publishing on the Chrome Web Store

Everything here is done by hand, from the maintainer's Mac, with meitogi's Google account. Commands run
from the root of this repository.

## 1. Before the first submission

| # | Do | Check |
|---|---|---|
| 1 | `git push origin main` | [cws/PRIVACY.md](https://github.com/meitogi/robrowser-relay/blob/main/cws/PRIVACY.md) opens on GitHub: the dashboard asks for this URL |
| 2 | Build the zip (below) | `web-ext-artifacts/robrowser-relay-chrome-<version>.zip` exists |
| 3 | Load `dist/chrome` unpacked in Chrome (`chrome://extensions` → **Developer mode** → **Load unpacked**) and play once | no **Errors** button on its card; the game loads, badge **GRF** |

```bash
node build.mjs
npx web-ext@10.8.0 build --source-dir dist/chrome --artifacts-dir web-ext-artifacts \
	--filename 'robrowser-relay-chrome-{version}.zip' --overwrite-dest
```

## 2. The developer account (once)

1. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), signed in with meitogi's
   Google account. If it asks for 2-Step Verification, turn it on for that account first
   ([myaccount.google.com/security](https://myaccount.google.com/security)).
2. Accept the developer agreement.
3. Pay the registration fee (5 USD, once, by card).
4. **Account** (left menu): publisher name `meitogi`, a contact e-mail, then verify it from the e-mail
   Google sends. The dashboard refuses to publish while it is not verified.

## 3. The first submission

1. **Items** → **New item** → drop the zip.
2. Fill each tab from [LISTING.md](LISTING.md), field by field:

| Tab | What |
|---|---|
| **Store listing** | description, category, language; store icon `ext/icons/icon-128.png`; at least one screenshot, 1280×800 (the relay's welcome page with **Ready** is fine); homepage and support URLs |
| **Privacy** | single purpose; a justification for `unlimitedStorage`, `declarativeNetRequestWithHostAccess` and the host permissions; remote code: **No**; data usage: tick no data type, tick the three certifications; privacy policy URL |
| **Distribution** | visibility **Unlisted** for the private beta; all regions |

3. **Submit for review**. Leave **Publish automatically after review** on, unless the release should wait.

The dashboard says which fields are still missing when **Submit** stays greyed out. Review takes from a
few hours to several days; Google writes to the contact e-mail when it is done, or asks questions.

## 4. Once it is published

1. Copy the item's page URL from the dashboard (`https://chromewebstore.google.com/detail/…/<id>`).
2. Give it to the game pages: the landing's install link (`INSTALL_URL` in `shared/index.html` of the
   roBrowserLegacy fork's `ci/pages-builds`) and the README's **Install and play**.
3. Attach the zip to the GitHub release of the same version, next to the Firefox xpi.

## 5. An update

1. Bump `version` in `ext/manifest.json` (the store refuses a version it has already seen; AMO too, so
   both browsers move together).
2. Build the zip (section 1).
3. Dashboard → the item → **Package** → **Upload new package** → the zip.
4. If a permission or a host changed: update the **Privacy** tab's justifications, and
   [LISTING.md](LISTING.md) with them.
5. **Submit for review**.

Installed copies update by themselves within a few hours of the store publishing the new version.

## Later: updates from the command line

The Chrome Web Store has an API to upload a new zip and submit it, with OAuth credentials created in a
Google Cloud project. They would stay on the maintainer's Mac, as the AMO keys do for `sign.sh`. The
listing itself is still edited in the dashboard. Not set up yet: a script comes once the first version is
published, written from the API's documentation.
