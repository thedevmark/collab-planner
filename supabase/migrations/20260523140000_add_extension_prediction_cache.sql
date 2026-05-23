-- Cache for on-demand extension panel predictions for channels without a CP account.
-- payload is nullable so a sentinel row can mark "analysis in flight" — see app/api/extension/channel/[channelId]/panel/route.ts.

create table if not exists "ExtensionPredictionCache" (
  "twitchId"   text primary key,
  "payload"    jsonb,
  "computedAt" timestamptz not null default now(),
  "expiresAt"  timestamptz not null
);

create index if not exists "ExtensionPredictionCache_expiresAt_idx"
  on "ExtensionPredictionCache" ("expiresAt");
