# Publishing the players' kit on Cloudflare R2

`publish.sh` builds `grf-offline-cyro.zip` and uploads it, with the online copy of the guide, to a
Cloudflare R2 bucket. This page is what to set up **once** on Cloudflare's side first. The menu names
come from Cloudflare's documentation, read on its source
([cloudflare/cloudflare-docs](https://github.com/cloudflare/cloudflare-docs/tree/production/src/content/docs/r2))
on 2026-10-18; when a screen has been renamed, the doc page linked from each step wins.

You end with four values: the **Account ID**, an **Access Key ID**, a **Secret Access Key**, and the
bucket's **public address**.

## 1. Turn R2 on

Dashboard → **R2 object storage**. Cloudflare asks to turn R2 on (« purchase ») before a token can be made,
even to stay in the free tier: it asks for a card.

Free each month ([pricing](https://developers.cloudflare.com/r2/pricing/)):

| | Free / month | For the kit |
|---|---|---|
| Storage (Standard) | 10 GB-month | the zip is about 6 GB: **one** zip fits, not two |
| Class A operations (writes) | 1 million | one upload ≈ 90 requests (64 MB parts) |
| Class B operations (reads) | 10 million | one player's download ≈ 1 request |
| Egress to the Internet | **free** | no cost per download |

That is why the script keeps one large object, `grf-offline-cyro.zip`, replaced at each publish (plus
`guide/START-HERE.html`, `guide/README.txt` and the extension alone, `extensions/roBrowser-relay-firefox.xpi`
and `extensions/roBrowser-relay-chrome.zip`, about 1 MB). The older `cyro-client.zip` is deleted from the
bucket after the kit's first verified upload.

## 2. Create the bucket

R2 object storage → **Create bucket** ([doc](https://developers.cloudflare.com/r2/buckets/create-buckets/)).

- **Name**: free, for example `cyro`. The script finds it alone when it is the only one the token can list,
  else it asks (or `--bucket <name>`). Lowercase, digits and dashes, 3 to 63 characters.
- **Location / jurisdiction**: leave it automatic. A bucket created with a jurisdiction (EU…) has another
  endpoint: pass `R2_ENDPOINT=https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com` to the script.
- **Storage class**: *Standard*. The free tier does not cover *Infrequent Access*.

## 3. The Account ID

Either ([doc](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)):

- the **R2 object storage** page, **Account Details** section;
- or anywhere in the dashboard: **Search** (`Cmd + K`) → `Copy account ID`.

32 hexadecimal characters. The endpoint follows from it, `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`,
and the script builds it.

## 4. The API token

R2 object storage → **Account Details** → **Manage** next to **API Tokens**
([doc](https://developers.cloudflare.com/r2/api/tokens/)).

1. **Create Account API token** (tied to the account, it outlives a change of user) or **Create User API
   token** (tied to your user: it inherits your permissions and stops if your user leaves the account).
   Both give the same Access Key ID / Secret pair; the script makes no difference.
2. **Permissions**: **Object Read & Write**. Not *Admin*: the script only reads and writes objects.
3. Scope it to the bucket of step 2 only.
4. An expiry date if you like; otherwise it stays valid until revoked.
5. **Create Account API token** (or **Create User API token**).

The next screen shows the **Access Key ID** and the **Secret Access Key**. ⚠︎ **The Secret is shown once
only**: copy it into your password manager at once. Lost = make a new token.

Never paste the Secret in a chat, a file of the repository or a commit. The script asks for it hidden, or
reads it from the environment, and writes it nowhere.

## 5. The public address

Bucket → **Settings** ([doc](https://developers.cloudflare.com/r2/buckets/public-buckets/)). Two options,
independent:

| | Custom domain (recommended) | `r2.dev` subdomain |
|---|---|---|
| Where | **Custom Domains** → **Add** | **Public Development URL** → enable |
| Needs | the domain is a zone of **this** Cloudflare account | nothing |
| Players' link | `https://files.<domain>/guide/START-HERE.html` | `https://pub-<id>.r2.dev/guide/START-HERE.html` |
| Limits | none; Cloudflare's cache, WAF rules possible | **rate-limited**, « for development only » says Cloudflare |

Custom domain: type for example `files.<domain>`, **Continue**, check the DNS record it proposes, **Connect
Domain**. The status goes from *Initializing* to *Active* within minutes (else **…** → *Retry connection*).

The bucket does not list its content: only whoever has the exact link downloads.

Once the domain is *Active*, set it at the top of `publish.sh` (`R2_PUBLIC_URL=…`): it only prints and
checks the players' links. The guide links to the zip relatively; nothing else changes.

**Someone else's domain.** R2 requires it: *« The domain being used must have been added as a zone in the
same account as the R2 bucket. »* For a subdomain of a domain on another account, the bucket has to live
on **that** account (its owner invites you: **Members** → **Invite members**, roles *Cloudflare R2 Admin* +
*Domain DNS*, or *Administrator*), with its card and its free tier. A CNAME to `pub-….r2.dev` is an
*« unsupported access path »*; delegating the subdomain to your account needs the Enterprise plan. The
simplest: your own domain, **Domain Registration** → **Register Domains**.

## 6. Publish

From the monorepo, on the host:

```bash
wtf relay kit-publish
```

The script asks for the three values (Account ID, Access Key ID, hidden Secret). To skip typing the first
two, pass them for that command only:

```bash
R2_ACCOUNT_ID=<account id> R2_ACCESS_KEY_ID=<access key id> wtf relay kit-publish
```

(The Secret is still asked hidden, so it does not end up in the shell history.)

Without `wtf`: `KIT_GAME_DIR=<client folder> bash player-kit/publish.sh`, from this repository.

What it does: rebuilds the extension, checks that the signed xpi of its version exists (else
`./sign.sh --channel=unlisted`), renders the guides (store links from `store-links.env`), zips the kit into
`dist/grf-offline-cyro-<date>.zip`, fetches rclone (once, SHA256 checked), uploads the zip as
`grf-offline-cyro.zip` (after the extension alone, so its links answer while the kit uploads), compares the
local and remote md5, uploads the online guide, deletes `cyro-client.zip` if it is still there, then the
local zip (`--keep-zip` keeps it). It lists what the bucket holds, checks that the players' links answer 200
(else exit 3) and prints the
announce, `dist/DISCORD.md` (from `DISCORD.template.md`: the store pages replace the extension's files once
they are in `store-links.env`).

`--build-only` does everything up to the tested zip and uploads nothing (no network needed).

## When it fails

| Message | Likely cause |
|---|---|
| `401 Unauthorized` / `SignatureDoesNotMatch` | Access Key or Secret mistyped, or token revoked |
| `403 AccessDenied` | the token has no *Object Read & Write* on **this** bucket |
| `NoSuchBucket` | bucket name mistyped: `--bucket <name>` |
| `AccessDenied` on the listing | the bucket is outside the token's scope: check the name, or the token's scope |
| DNS / connection error on `…r2.cloudflarestorage.com` | bucket created with a jurisdiction: `R2_ENDPOINT` (step 2) |
| `does not match the local zip` | incomplete upload: run it again, the local zip was kept |
| `no signed Firefox package for <version>` | `ext/manifest.json`'s version is not signed: `./sign.sh --channel=unlisted` |
| `✗ HTTP 000` on the players' links (exit 3) | the upload is done, the public address does not answer: its DNS does not resolve or its certificate is not issued yet. The custom domain must be listed and *Active* under **this** bucket's **Custom Domains**, on the account the token belongs to. Fix it, then `curl -I <public address>/guide/START-HERE.html`: no new upload needed |
| `✗ HTTP 404` on the players' links (exit 3) | the domain is connected to another bucket |
| the dashboard shows the bucket empty after a verified upload | another account or another bucket is open in the dashboard: the run prints the bucket, the account and what the bucket holds |
