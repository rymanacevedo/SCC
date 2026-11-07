# Feature flags

On/off switches stored in the `FLAGS` Workers KV namespace (binding `FLAGS` in
`wrangler.jsonc`). A flip takes effect within about a minute and needs no
deploy.

| piece | file |
|---|---|
| schema: every flag and its default (all off) | `shared/flags.ts` |
| reader with a short cache | `worker/flags.ts` |
| route exposing the resolved set | `worker/flags-route.ts` (`GET /api/flags`) |
| client hook, defaults on failure | `app/flags.ts` (`useFlags()`) |

## Flip a flag

The KV key is the flag name; the value is `true` or `false`. Anything else,
a missing key or a KV failure reads as the default.

```sh
bunx wrangler kv key put --binding FLAGS --remote <flagName> true    # on
bunx wrangler kv key put --binding FLAGS --remote <flagName> false   # off
bunx wrangler kv key list --binding FLAGS --remote                   # what is set
bunx wrangler kv key delete --binding FLAGS --remote <flagName>      # back to the default
```

## Rules

- Every default in `shared/flags.ts` is `false`. A flag turns a feature on.
- A PR that adds a flag also files its removal issue: the issue that deletes
  the flag and its dead branch once the feature is settled. Link it in the PR
  body and beside the flag in `shared/flags.ts`.
- On/off only; gradual rollout stays with the platform.

## Setup (once)

Create the namespace and put its id on the `FLAGS` binding in
`wrangler.jsonc`, replacing the placeholder:

```sh
bunx wrangler kv namespace create FLAGS
```
