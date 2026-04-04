-- Lock down public app tables exposed through Supabase's Data API.
-- This app reads/writes via server-side Prisma using a direct Postgres connection,
-- so no PostgREST policies are required for normal operation.

ALTER TABLE IF EXISTS public."Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Friend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."StreamHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."ScheduleSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."EventParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."CollabSignal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."CollabHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Reminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."MessageLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."GoogleAuth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."CollabInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."CollabInviteRecipient" ENABLE ROW LEVEL SECURITY;
