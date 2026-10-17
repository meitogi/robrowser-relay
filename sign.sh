#!/usr/bin/env bash
# HOST-SIDE ONLY. Lints and signs the relay extension (ext/) on AMO.
#   --channel=unlisted  (default) signed xpi, installable from a direct link, not on addons.mozilla.org
#   --channel=listed    public AMO page; sends the listing from amo/metadata.json (human review)
#   --dry-run           prints the web-ext command line and stops: no lint, no network, no credentials
# AMO credentials come from the host environment and never enter the container:
#   export AMO_JWT_ISSUER=user:12345:678   AMO_JWT_SECRET=...
# Run from anywhere:  ./sign.sh --channel=listed
# Bump "version" in ext/manifest.json first: AMO refuses a version it has already seen.
set -euo pipefail
cd "$(dirname "$0")"

channel=unlisted
dry=
for arg in "$@"; do
	case "$arg" in
	--channel=listed | --channel=unlisted) channel=${arg#--channel=} ;;
	--dry-run) dry=1 ;;
	*)
		echo "usage: $0 [--channel=listed|unlisted] [--dry-run]" >&2
		exit 2
		;;
	esac
done

if [ -z "$dry" ]; then
	: "${AMO_JWT_ISSUER:?export AMO_JWT_ISSUER (addons.mozilla.org > Developer Hub > API keys)}"
	: "${AMO_JWT_SECRET:?export AMO_JWT_SECRET}"
fi

WEB_EXT=web-ext@10.8.0
# "Waiting for approval…" prints for every submission; wait up to 45 min instead of the 15 min default.
sign=(npx --yes "$WEB_EXT" sign --channel="$channel" --approval-timeout 2700000
	--source-dir ext
	--artifacts-dir web-ext-artifacts
	--api-key "${AMO_JWT_ISSUER:-\$AMO_JWT_ISSUER}" --api-secret "${AMO_JWT_SECRET:-\$AMO_JWT_SECRET}")
# The listing (name, summary, categories, licence, reviewer notes) goes with the listed submission only.
if [ "$channel" = listed ]; then
	sign+=(--amo-metadata amo/metadata.json)
fi

if [ -n "$dry" ]; then
	printf '%q ' "${sign[@]}" | sed "s/--api-secret [^ ]*/--api-secret '***'/"
	echo
	exit 0
fi

log="sign-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee "$log") 2>&1

echo "=== lint"
npx --yes "$WEB_EXT" lint --source-dir ext
echo "=== sign ($channel)"
"${sign[@]}"
ls -l web-ext-artifacts/*.xpi
echo "SIGN DONE"
