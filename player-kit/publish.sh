#!/usr/bin/env bash
# publish.sh — build the players' kit, grf-offline-cyro.zip, and upload it to Cloudflare R2.
# Upload from the maintainer's machine : R2 and rclone's download site must be reachable.
#
#   KIT_GAME_DIR=<client folder> bash player-kit/publish.sh [--bucket <name>] [--keep-zip] [--build-only]
#
# The kit, at the zip's root :
#   START-HERE.html, README.txt   the player guides, rendered by player-kit/render.mjs
#                                 (store links from player-kit/store-links.env)
#   extensions/firefox/           the signed xpi of ext/manifest.json's version (./sign.sh)
#   extensions/chrome/            dist/chrome, for « Load unpacked »
#   extensions/tampermonkey/      the cyro-live-patch userscript
#   game/                         KIT_GAME_DIR, the client folder (data.grf, BGM/, AI/, System/)
# game/ is staged as a symlink (zip follows it), so the 5.7 GB of game files are not copied.
#
# Uploaded as grf-offline-cyro.zip, plus guide/START-HERE.html and guide/README.txt, so a link shows the
# guide before the download (its download button is ../grf-offline-cyro.zip), and the extension alone,
# extensions/roBrowser-relay-firefox.xpi and extensions/roBrowser-relay-chrome.zip, so a player installs it
# while the kit downloads. The announce, with all those links, ends in dist/DISCORD.md. One zip only : R2's free
# tier is 10 GB. The older cyro-client.zip is deleted from the bucket once the kit is verified.
#
# The zip is built in dist/. --build-only : build and test it, no upload ; needs no network. --keep-zip :
# keep the local zip after the verified upload. KIT_XPI replaces the signed xpi, for a test kit.
#
# Step by step on Cloudflare's side (bucket, token, public link) : PUBLISH.md, beside this script.
#
# Credentials (R2 → Manage API tokens, Object Read & Write on the bucket ; an Account or a User token)
# come from R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY, or are asked for. They go to rclone
# through its environment only : nothing is written to disk. R2_ENDPOINT overrides the endpoint, for a
# bucket created with a jurisdiction (EU : https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com).
#
# rclone is not installed : the official build for this OS and CPU is fetched once into
# ~/.cache/cyro-r2/, after its SHA256 is checked against the release's SHA256SUMS.
#
# Written for the bash 3.2 macOS ships : no associative arrays, no ${x,,}.
set -euo pipefail

# The bucket's public address : its custom domain once connected, else its r2.dev URL. Only used to
# print the players' links and check they answer.
R2_PUBLIC_URL=${R2_PUBLIC_URL:-https://files.suuuper.app}

KIT=grf-offline-cyro
OLD_OBJECT=cyro-client.zip

RELAY=$(cd "$(dirname "$0")/.." && pwd)
GAME=${KIT_GAME_DIR:-}
REL="$RELAY/dist"
BUCKET=${R2_BUCKET:-}
KEEP_ZIP=0
BUILD_ONLY=0

while [ $# -gt 0 ]; do
	case "$1" in
		--bucket)     BUCKET=${2:?--bucket needs a name}; shift 2 ;;
		--keep-zip)   KEEP_ZIP=1; shift ;;
		--build-only) BUILD_ONLY=1; shift ;;
		*) echo "✗ unknown option '$1'" >&2; exit 2 ;;
	esac
done

if [ "$BUILD_ONLY" = 0 ] && { [ -f /.dockerenv ] || [ -n "${REMOTE_CONTAINERS:-}" ]; }; then
	echo "✗ upload from the host, not from a container (a firewalled one reaches neither rclone's site nor R2)." >&2
	echo "  → --build-only works here" >&2
	exit 2
fi

[ -n "$GAME" ] || { echo "✗ set KIT_GAME_DIR to the client folder (the one that holds data.grf)" >&2; exit 2; }
[ -f "$GAME/data.grf" ] || { echo "✗ $GAME/data.grf not found" >&2; exit 2; }

# ── progress ────────────────────────────────────────────────────────────────
# GNU first : on Linux `stat -f` exists too, but reports the FILESYSTEM, not the file.
filesize() { stat -c %s "$1" 2>/dev/null || stat -f %z "$1"; }

# run_with_progress <label> <target bytes> <file to watch> <command…>
# Runs the command in the background and redraws one line a second : a bar from
# the watched file's size against the target, or the elapsed time when there is
# nothing to measure (target 0).
run_with_progress() {
	local label=$1 total=$2 watch=$3 pid start el cur pct fill rc=0
	shift 3
	"$@" &
	pid=$!
	start=$(date +%s)
	while kill -0 "$pid" 2>/dev/null; do
		el=$(( $(date +%s) - start ))
		if [ "$total" -gt 0 ] && [ -f "$watch" ]; then
			cur=$(filesize "$watch")
			pct=$(( cur * 100 / total ))
			if [ "$pct" -gt 100 ]; then pct=100; fi
			fill=$(( pct * 30 / 100 ))
			printf '\r[publish] %s [%s%s] %3d%%  %d / %d MB  %ds ' "$label" \
				"$(printf '%*s' "$fill" '' | tr ' ' '#')" "$(printf '%*s' $(( 30 - fill )) '' | tr ' ' '.')" \
				"$pct" $(( cur / 1048576 )) $(( total / 1048576 )) "$el"
		else
			printf '\r[publish] %s … %ds ' "$label" "$el"
		fi
		sleep 1
	done
	wait "$pid" || rc=$?
	printf '\n'
	return "$rc"
}

# ── the extension ───────────────────────────────────────────────────────────
(cd "$RELAY" && node build.mjs >/dev/null)
VERSION=$(node -p "require('$RELAY/ext/manifest.json').version")
XPI=${KIT_XPI:-$RELAY/web-ext-artifacts/robrowser_relay-$VERSION.xpi}
if [ ! -f "$XPI" ]; then
	echo "✗ no signed Firefox package for $VERSION : $XPI" >&2
	echo "  → ./sign.sh --channel=unlisted   (AMO keys in AMO_JWT_ISSUER / AMO_JWT_SECRET)" >&2
	exit 2
fi
echo "[publish] roBrowser relay $VERSION — $(basename "$XPI")"

# ── stage the kit ───────────────────────────────────────────────────────────
# The guides are rendered here.
STAGE="$REL/$KIT"
mkdir -p "$REL"
rm -rf "$STAGE"
mkdir -p "$STAGE/extensions/firefox" "$STAGE/extensions/tampermonkey"
GAME_BYTES=$(( $(du -skL "$GAME" | awk '{print $1}') * 1024 ))
SIZE=$(awk -v b="$GAME_BYTES" 'BEGIN { printf "%.1f GB", b / 1e9 }')
node "$RELAY/player-kit/render.mjs" "$STAGE" --size "$SIZE" | sed 's/^/[publish] /'
# extensions/ is a copy (80 KB) with its modes set : the zip keeps them, and a copy made on the
# devcontainer's bind mount can come out unreadable (icons at --w-------), which Chrome refuses.
cp "$XPI" "$STAGE/extensions/firefox/roBrowser-relay-$VERSION.xpi"
cp -R "$RELAY/dist/chrome" "$STAGE/extensions/chrome"
cp "$RELAY/cyro-live-patch/robrowser-relay-cyro.user.js" "$STAGE/extensions/tampermonkey/cyro-live-patch.user.js"
chmod -R u=rwX,go=rX "$STAGE/extensions" "$STAGE/START-HERE.html" "$STAGE/README.txt"
ln -s "$GAME" "$STAGE/game"

# ── zip ─────────────────────────────────────────────────────────────────────
# mkzip <out> <dir> <entry…> : a stored zip (the GRF and the mp3s are already compressed) of the entries
# of <dir>, links followed, without Finder's and web-ext's droppings.
mkzip() {
	local out=$1 dir=$2
	shift 2
	if command -v zip >/dev/null 2>&1; then
		(cd "$dir" && zip -q -r -0 "$out" "$@" -x "*.DS_Store" "*.amo-upload-uuid")
	else
		# No zip command (a slim container) : the same archive from Python.
		python3 -c '
import os, sys, zipfile
out, root, tops = sys.argv[1], sys.argv[2], sys.argv[3:]
with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED, allowZip64=True) as z:
    for top in tops:
        path = os.path.join(root, top)
        walk = os.walk(path, followlinks=True) if os.path.isdir(path) else [(root, [], [top])]
        for d, _, files in walk:
            for f in sorted(files):
                if f not in (".DS_Store", ".amo-upload-uuid"):
                    full = os.path.join(d, f)
                    z.write(full, os.path.relpath(full, root))
' "$out" "$dir" "$@"
	fi
}

# The extension alone, so a player installs it while the kit downloads : the xpi, and the Chrome
# folder zipped under the name the guide gives it. Stable names : the links do not change.
ALONE="$REL/extensions"
rm -rf "$ALONE" "$REL/alone"
mkdir -p "$ALONE" "$REL/alone"
cp "$STAGE/extensions/firefox/roBrowser-relay-$VERSION.xpi" "$ALONE/roBrowser-relay-firefox.xpi"
cp -R "$STAGE/extensions/chrome" "$REL/alone/roBrowser-relay-chrome"
mkzip "$ALONE/roBrowser-relay-chrome.zip" "$REL/alone" roBrowser-relay-chrome
rm -rf "$REL/alone"
echo "[publish] $ALONE/ — roBrowser-relay-firefox.xpi, roBrowser-relay-chrome.zip"

# The kit. Rebuilt every run : the guides or the extension may have changed since the last one.
ZIP="$REL/$KIT-$(date +%Y-%m-%d).zip"
rm -f "$ZIP" "$ZIP.part"
echo "[publish] zipping the kit → $ZIP"
run_with_progress zip "$GAME_BYTES" "$ZIP.part" mkzip "$ZIP.part" "$STAGE" START-HERE.html README.txt extensions game
mv "$ZIP.part" "$ZIP"
rm -rf "$STAGE"
run_with_progress "integrity test" 0 "" sh -c 'unzip -tq "$1" >/dev/null' _ "$ZIP" || { echo "✗ $ZIP fails its own integrity test" >&2; exit 2; }
echo "[publish] $ZIP — $(du -h "$ZIP" | awk '{print $1}'), integrity ok"

node "$RELAY/player-kit/render.mjs" "$REL" --size "$SIZE" --discord "$R2_PUBLIC_URL" >/dev/null

if [ "$BUILD_ONLY" = 1 ]; then
	unzip -Z1 "$ZIP" | awk -F/ '{ print ($2 == "" || $1 != "game") ? $0 : $1 "/" $2 }' | awk '!seen[$0]++' | sed 's/^/  /'
	echo "[publish] --build-only : nothing uploaded, the zip is kept ; the announce, once published :"
	sed 's/^/  /' "$REL/DISCORD.md"
	exit 0
fi

# ── rclone ──────────────────────────────────────────────────────────────────
case "$(uname -s)" in
	Darwin) OS=osx ;;
	Linux)  OS=linux ;;
	*) echo "✗ unsupported OS $(uname -s)" >&2; exit 2 ;;
esac
case "$(uname -m)" in
	arm64|aarch64) ARCH=arm64 ;;
	x86_64)        ARCH=amd64 ;;
	*) echo "✗ unsupported CPU $(uname -m)" >&2; exit 2 ;;
esac
sha256() {
	if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'; else sha256sum "$1" | awk '{print $1}'; fi
}

CACHE="$HOME/.cache/cyro-r2"
RCLONE_VERSION=$(curl -fsSL https://downloads.rclone.org/version.txt | awk '{print $2}')
[ -n "$RCLONE_VERSION" ] || { echo "✗ could not read rclone's current version" >&2; exit 2; }
RCLONE="$CACHE/rclone-$RCLONE_VERSION-$OS-$ARCH/rclone"
if [ ! -x "$RCLONE" ]; then
	PKG="rclone-$RCLONE_VERSION-$OS-$ARCH.zip"
	mkdir -p "$CACHE"
	echo "[publish] fetching rclone $RCLONE_VERSION ($OS-$ARCH)"
	curl -fSL --progress-bar -o "$CACHE/$PKG" "https://downloads.rclone.org/$RCLONE_VERSION/$PKG"
	WANT=$(curl -fsSL "https://downloads.rclone.org/$RCLONE_VERSION/SHA256SUMS" | awk -v f="$PKG" '$2 == f {print $1}')
	GOT=$(sha256 "$CACHE/$PKG")
	if [ -z "$WANT" ] || [ "$WANT" != "$GOT" ]; then
		rm -f "$CACHE/$PKG"
		echo "✗ SHA256 mismatch for $PKG (expected '${WANT:-none}', got $GOT) — not using it." >&2
		exit 2
	fi
	(cd "$CACHE" && unzip -q -o "$PKG" && rm -f "$PKG")
	chmod +x "$RCLONE"
fi
echo "[publish] $("$RCLONE" version | head -1)"

# ── credentials, environment only ───────────────────────────────────────────
[ -n "${R2_ACCOUNT_ID:-}" ] || [ -n "${R2_ENDPOINT:-}" ] || read -r -p "R2 account id : " R2_ACCOUNT_ID
[ -n "${R2_ACCESS_KEY_ID:-}" ]     || read -r -p "R2 access key id : " R2_ACCESS_KEY_ID
if [ -z "${R2_SECRET_ACCESS_KEY:-}" ]; then
	read -r -s -p "R2 secret access key (hidden) : " R2_SECRET_ACCESS_KEY
	echo
fi
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="${R2_ENDPOINT:-https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com}"
# A token scoped to one bucket may not list or create buckets.
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

# ── which bucket ────────────────────────────────────────────────────────────
if [ -z "$BUCKET" ]; then
	if LSD=$("$RCLONE" lsd r2: --low-level-retries 1 --retries 1 2>/dev/null); then
		NAMES=$(printf '%s\n' "$LSD" | awk 'NF {print $NF}')
		COUNT=$(printf '%s\n' "$NAMES" | grep -c . || true)
		if [ "$COUNT" = 1 ]; then
			BUCKET=$NAMES
			echo "[publish] bucket : $BUCKET (the only one on this account)"
		elif [ "$COUNT" -gt 1 ]; then
			echo "[publish] buckets on this account :"
			printf '%s\n' "$NAMES" | sed 's/^/  - /'
			read -r -p "R2 bucket : " BUCKET
		fi
	fi
	# Listing refused (a token scoped to one bucket) or no bucket listed.
	[ -n "$BUCKET" ] || read -r -p "R2 bucket name : " BUCKET
fi
[ -n "$BUCKET" ] || { echo "✗ no bucket given" >&2; exit 2; }

# ── preflight ───────────────────────────────────────────────────────────────
# A HEAD answers a bare 403 whatever the cause ; a listing carries the S3 error
# code, so a bad secret, a token without this bucket or a missing bucket each get
# their own message before a 5.7 GB upload is attempted.
if ! PRE=$("$RCLONE" lsf "r2:$BUCKET" --max-depth 1 --low-level-retries 1 --retries 1 2>&1); then
	echo "✗ R2 refused a listing of '$BUCKET' :" >&2
	echo "$PRE" | grep -E 'ERROR|error' | tail -2 >&2
	case "$PRE" in
		*SignatureDoesNotMatch*) echo "  → the Secret Access Key does not match the Access Key ID : paste the « Secret Access Key », not the « Token value »." >&2 ;;
		*InvalidAccessKeyId*|*Unauthorized*) echo "  → unknown Access Key ID, or the token was revoked." >&2 ;;
		*NoSuchBucket*) echo "  → no bucket '$BUCKET' at this endpoint : check its exact name (--bucket), or its jurisdiction (R2_ENDPOINT)." >&2 ;;
		*AccessDenied*|*Forbidden*) echo "  → the token has no Object Read & Write on '$BUCKET' : edit the token's bucket scope, or pass --bucket <its bucket>." >&2 ;;
	esac
	echo "  The zip is kept : $ZIP" >&2
	exit 2
fi

# ── upload, verify ──────────────────────────────────────────────────────────
# The extension alone first : a few seconds, and its links answer while the kit uploads. Firefox installs
# an xpi from a link only when it comes as application/x-xpinstall.
"$RCLONE" copyto "$ALONE/roBrowser-relay-firefox.xpi" "r2:$BUCKET/extensions/roBrowser-relay-firefox.xpi" --header-upload "Content-Type: application/x-xpinstall"
"$RCLONE" copyto "$ALONE/roBrowser-relay-chrome.zip" "r2:$BUCKET/extensions/roBrowser-relay-chrome.zip" --header-upload "Content-Type: application/zip"
echo "[publish] r2:$BUCKET/extensions/ — roBrowser-relay-firefox.xpi, roBrowser-relay-chrome.zip"

"$RCLONE" copyto "$ZIP" "r2:$BUCKET/$KIT.zip" --progress --s3-chunk-size 64M --s3-upload-concurrency 4
MD5_OUT=$(mktemp)
run_with_progress "md5 of the local zip" 0 "" sh -c '"$1" md5sum "$2" > "$3"' _ "$RCLONE" "$ZIP" "$MD5_OUT"
LOCAL_MD5=$(awk '{print $1}' "$MD5_OUT")
rm -f "$MD5_OUT"
REMOTE_MD5=$("$RCLONE" md5sum "r2:$BUCKET/$KIT.zip" | awk '{print $1}')
if [ -z "$REMOTE_MD5" ] || [ "$LOCAL_MD5" != "$REMOTE_MD5" ]; then
	echo "✗ r2:$BUCKET/$KIT.zip does not match the local zip (md5 local $LOCAL_MD5, remote '${REMOTE_MD5:-none}') — local zip kept." >&2
	exit 2
fi
echo "[publish] r2:$BUCKET/$KIT.zip ($(basename "$ZIP")) — md5 $LOCAL_MD5, verified"

# The online guide : the same two files as in the zip, rendered again.
GUIDE=$(mktemp -d)
node "$RELAY/player-kit/render.mjs" "$GUIDE" --size "$SIZE" >/dev/null
"$RCLONE" copyto "$GUIDE/START-HERE.html" "r2:$BUCKET/guide/START-HERE.html" --header-upload "Content-Type: text/html; charset=utf-8"
"$RCLONE" copyto "$GUIDE/README.txt" "r2:$BUCKET/guide/README.txt" --header-upload "Content-Type: text/plain; charset=utf-8"
rm -rf "$GUIDE"
echo "[publish] r2:$BUCKET/guide/ — START-HERE.html, README.txt"

if printf '%s\n' "$PRE" | grep -qx "$OLD_OBJECT"; then
	"$RCLONE" deletefile "r2:$BUCKET/$OLD_OBJECT"
	echo "[publish] r2:$BUCKET/$OLD_OBJECT removed (the kit replaces it ; one zip fits R2's free tier)"
fi

if [ "$KEEP_ZIP" = 0 ]; then
	rm -f "$ZIP"
	echo "[publish] local zip removed (R2 holds the verified copy) — --keep-zip to keep it"
fi

# ── the players' links ──────────────────────────────────────────────────────
echo "[publish] players' links :"
for path in guide/START-HERE.html "$KIT.zip" extensions/roBrowser-relay-firefox.xpi extensions/roBrowser-relay-chrome.zip; do
	code=$(curl -s -o /dev/null -I -w '%{http_code}' "$R2_PUBLIC_URL/$path" || true)
	if [ "$code" = 200 ]; then mark='✓'; else mark="✗ HTTP $code"; fi
	echo "  $mark $R2_PUBLIC_URL/$path"
done
echo "  (public address : R2_PUBLIC_URL, at the top of player-kit/publish.sh)"
echo "[publish] the announce, $REL/DISCORD.md :"
sed 's/^/  /' "$REL/DISCORD.md"
