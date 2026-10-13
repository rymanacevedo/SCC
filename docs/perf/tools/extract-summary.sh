#!/usr/bin/env bash
# Usage: extract-summary.sh <perf-dir> [thresholds.json]   -> merges lighthouse medians into <perf-dir>/summary.json and writes tier1.md (table)
# Contract: Lighthouse 13.x audit IDs below; LHCI manifest.json fields url/isRepresentativeRun/jsonPath.
set -euo pipefail
dir="$1"
thresholds="${2:-$(dirname "$0")/../thresholds.json}"
exclude_hosts="$(jq -ce '.excludeScriptHosts' "$thresholds")"
rows="$(mktemp)"
for manifest in "$dir"/lighthouse/*/*/manifest.json; do
  ff="$(basename "$(dirname "$(dirname "$manifest")")")"
  page="$(basename "$(dirname "$manifest")")"
  rep="$(jq -r '.[] | select(.isRepresentativeRun) | .jsonPath' "$manifest")"
  runs="$(mktemp)"
  jq -r '.[].jsonPath' "$manifest" | while read -r lhr; do
    [ -f "$lhr" ] || lhr="$(dirname "$manifest")/$lhr"
    jq -c --argjson excludeHosts "$exclude_hosts" '
    def scriptRequests: .audits["network-requests"].details.items[] | select(.resourceType == "Script");
    def excluded: (.url | capture("^https?://(?<host>[^/:]+)").host | ascii_downcase) as $host | $excludeHosts | index($host) != null;
    {
      perf: .categories.performance.score,
      ttfb: .audits["server-response-time"].numericValue,
      fcp: .audits["first-contentful-paint"].numericValue,
      lcp: .audits["largest-contentful-paint"].numericValue,
      tbt: .audits["total-blocking-time"].numericValue,
      cls: .audits["cumulative-layout-shift"].numericValue,
      si: .audits["speed-index"].numericValue,
      tti: .audits["interactive"].numericValue,
      bytesTotal: .audits["total-byte-weight"].numericValue,
      bytesScript: ([scriptRequests | select(excluded | not) | .transferSize] | add // 0),
      bytesScriptThirdParty: ([scriptRequests | select(excluded) | .transferSize] | add // 0),
      bytesDocument: ([.audits["resource-summary"].details.items[]? | select(.resourceType=="document") | .transferSize] | add)
    }' "$lhr"
  done > "$runs"
  jq -s --arg ff "$ff" --arg page "$page" --arg rep "$(basename "$rep")" '
    def med: map(select(. != null)) | sort
      | if length == 0 then null elif length % 2 == 1 then .[length/2|floor] else (.[length/2-1] + .[length/2]) / 2 end;
    {formFactor:$ff, page:$page, runs:length, representativeRun:$rep,
     median:{perf:(map(.perf)|med), ttfb:(map(.ttfb)|med), fcp:(map(.fcp)|med), lcp:(map(.lcp)|med),
             tbt:(map(.tbt)|med), cls:(map(.cls)|med), si:(map(.si)|med), tti:(map(.tti)|med),
             bytesTotal:(map(.bytesTotal)|med), bytesScript:(map(.bytesScript)|med), bytesScriptThirdParty:(map(.bytesScriptThirdParty)|med), bytesDocument:(map(.bytesDocument)|med)}}
  ' "$runs" >> "$rows"
  rm -f "$runs"
done
# Merge into an existing summary.json (keeps bundle/api/flows keys) or create it.
if [ -f "$dir/summary.json" ]; then
  jq -s '.[0] + {lighthouse: .[1:]}' "$dir/summary.json" "$rows" > "$dir/summary.tmp"
else
  jq -s '{lighthouse: .}' "$rows" > "$dir/summary.tmp"
fi
mv -f "$dir/summary.tmp" "$dir/summary.json"
{
  echo "| form factor | page | runs | perf (median) | TTFB ms | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | bytes total | App script bytes | Third-party script bytes | bytes document |"
  echo "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"
  jq -r '.lighthouse[] | [.formFactor, .page, .runs, .median.perf,
      (.median.ttfb|round), (.median.fcp|round), (.median.lcp|round), (.median.tbt|round),
      ((.median.cls*1000|round)/1000), (.median.si|round), (.median.tti|round),
      .median.bytesTotal, .median.bytesScript, .median.bytesScriptThirdParty, .median.bytesDocument]
    | "| " + (map(tostring) | join(" | ")) + " |"' "$dir/summary.json"
} > "$dir/tier1.md"
rm -f "$rows"
