-- Phase 6.3b: per-modality usage. Non-chat endpoints bill in units that are not
-- tokens — an image request costs per image, not per token. Rather than overload
-- `totalTokens` (which would corrupt every token sum, chart, and leaderboard), each
-- usage row now names its own unit and carries a count in that unit.
--
-- Additive and safe: both columns default, so every existing row and every current
-- token request reads as `unit = 'token', quantity = 0` with no behaviour change.
ALTER TABLE "TokenUsage"
  ADD COLUMN "unit"     TEXT    NOT NULL DEFAULT 'token',
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 0;
