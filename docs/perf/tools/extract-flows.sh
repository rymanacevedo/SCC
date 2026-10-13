#!/usr/bin/env bash
# Usage: extract-flows.sh <perf-dir>  -> writes <perf-dir>/flows.json (per form factor, per step: medians across run-*/)
# Contract: flow.mjs output files <perf-dir>/lighthouse/flows/run-N/flow-<formFactor>-<ai>.json (Lighthouse 13.x flow result).
set -euo pipefail
dir="$1"
rows="$(mktemp)"
for f in "$dir"/lighthouse/flows/run-*/flow-*.json; do
  run="$(basename "$(dirname "$f")")"
  base="$(basename "$f" .json)"           # flow-mobile-mock
  ff="$(echo "$base" | cut -d- -f2)"; ai="$(echo "$base" | cut -d- -f3)"
  jq -c --arg run "$run" --arg ff "$ff" --arg ai "$ai" '.steps | to_entries[] | {
    run:$run, formFactor:$ff, ai:$ai, step:.key, name:.value.name, mode:.value.lhr.gatherMode,
    perf:.value.lhr.categories.performance.score,
    fcp:.value.lhr.audits["first-contentful-paint"].numericValue, lcp:.value.lhr.audits["largest-contentful-paint"].numericValue,
    tbt:.value.lhr.audits["total-blocking-time"].numericValue, cls:.value.lhr.audits["cumulative-layout-shift"].numericValue,
    inp:.value.lhr.audits["interaction-to-next-paint"].numericValue, si:.value.lhr.audits["speed-index"].numericValue}' "$f"
done > "$rows"
jq -s '
  def med: map(select(. != null)) | sort | if length == 0 then null elif length % 2 == 1 then .[length/2|floor] else (.[length/2-1] + .[length/2]) / 2 end;
  group_by([.formFactor, .ai, .step]) | map({
    formFactor:.[0].formFactor, ai:.[0].ai, step:.[0].step, name:.[0].name, mode:.[0].mode, runs:length,
    median:{perf:(map(.perf)|med), fcp:(map(.fcp)|med), lcp:(map(.lcp)|med), tbt:(map(.tbt)|med), cls:(map(.cls)|med), inp:(map(.inp)|med), si:(map(.si)|med)}})
  | {flows: .}' "$rows" > "$dir/flows.json"
rm -f "$rows"
echo "| form factor | step | mode | runs | perf | FCP ms | LCP ms | TBT ms | CLS | INP ms |"
echo "|---|---|---|---|---|---|---|---|---|---|"
jq -r '.flows[] | [.formFactor, .name, .mode, .runs, .median.perf, (.median.fcp|if .==null then "-" else round end), (.median.lcp|if .==null then "-" else round end), (.median.tbt|if .==null then "-" else round end), (.median.cls|if .==null then "-" else ((.*1000|round)/1000) end), (.median.inp|if .==null then "-" else round end)] | "| " + (map(tostring)|join(" | ")) + " |"' "$dir/flows.json"
