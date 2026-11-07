# Feature flags

On/off switches served by [Flagship](https://developers.cloudflare.com/flagship/)
through the `FLAGS` binding in `wrangler.jsonc`. The Worker evaluates flags
locally, so a flip is live on the next request and needs no deploy.

| piece | file |
|---|---|
| schema: every flag and its default (all off) | `shared/flags.ts` |
| reader over the `FLAGS` binding, no cache | `worker/flags.ts` |
| route exposing the resolved set | `worker/flags-route.ts` (`GET /api/flags`) |
| client reader, defaults on failure | `app/flags.ts` (`flags.load()`, `flags.current()`, `flags.subscribe()`) |

The app id (`APP_ID` below) is the `app_id` on the `FLAGS` entry of the
`flagship` array in `wrangler.jsonc`.

## Flip a flag

The Flagship flag key is the flag's name in `shared/flags.ts`, verbatim. A
flag Flagship does not know, a non-boolean value or a binding failure reads
as the default.

```sh
bunx wrangler flagship flags set <APP_ID> <flagName> --variation on    # on
bunx wrangler flagship flags set <APP_ID> <flagName> --variation off   # off
bunx wrangler flagship flags list <APP_ID>                             # what is set
```

A flag is on when its default variation is `on`. `flags enable` and
`flags disable` only toggle the flag's enabled state: a disabled flag serves
its default variation, and `flags create` makes `off` the default, so
`enable` on its own never turns a flag on. Use `flags set`.

## Local development

The local flag store starts empty, so `wrangler dev` and the Vite plugin
serve every default until it is filled from the app:

```sh
bunx wrangler flagship flags pull <APP_ID>
```

## Rules

- Every default in `shared/flags.ts` is `false`. A flag turns a feature on.
- A PR that adds a key to `FLAG_DEFAULTS` also creates the flag in Flagship
  before merge, default off: `bunx wrangler flagship flags create <APP_ID> <flagName>`.
  A missing flag evaluates to the default, so nothing breaks if the order slips.
- A PR that adds a flag also files its removal issue: the issue that deletes
  the flag (`bunx wrangler flagship flags delete <APP_ID> <flagName>`) and its
  dead branch once the feature is settled. Link it in the PR body and beside
  the flag in `shared/flags.ts`.
- On/off only; the reader passes no evaluation context, so targeting and
  percentage rollouts stay unused.

## Setup (once)

Done for this Worker: the `FLAGS` binding in `wrangler.jsonc` carries the
app id. For a new Worker or a new account, create the app and put its id on
the binding by hand. The `--json` form, because Wrangler must not edit
`wrangler.jsonc` (the scaffold owns it):

```sh
bunx wrangler flagship apps create <worker name> --json | jq -r .id
```
