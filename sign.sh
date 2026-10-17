#!/usr/bin/env bash
# HOST-SIDE ONLY. Lints and signs the relay extension (relay/ext/) as an AMO *unlisted* add-on.
# AMO credentials come from the host environment and never enter the container:
#   export AMO_JWT_ISSUER=user:12345:678   AMO_JWT_SECRET=...
# Run from the repo root:  bash robrowser/tools/firefox-ext/relay/sign.sh
# Bump "version" in relay/ext/manifest.json first: AMO refuses a version it has already seen.
set -euo pipefail
cd "$(dirname "$0")"

: "${AMO_JWT_ISSUER:?export AMO_JWT_ISSUER (addons.mozilla.org > Developer Hub > API keys)}"
: "${AMO_JWT_SECRET:?export AMO_JWT_SECRET}"

WEB_EXT=web-ext@10.7.0
log="sign-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee "$log") 2>&1

echo "=== lint"
npx --yes "$WEB_EXT" lint --source-dir ext
echo "=== sign"
# "Waiting for approval…" prints for every submission; wait up to 45 min instead of the 15 min default.
npx --yes "$WEB_EXT" sign --channel=unlisted --approval-timeout 2700000 \
	--source-dir ext \
	--artifacts-dir web-ext-artifacts \
	--api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET"
ls -l web-ext-artifacts/*.xpi
echo "SIGN DONE"
