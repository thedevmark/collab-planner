"use client";

import FindTimeView from "@/components/calendar/FindTimeView";

/**
 * "When are we all free?" — overlap-first entry into the planning flow.
 *
 * Thin wrapper around <FindTimeView />. Previously lived as a tab inside
 * /calendar; promoted to its own route so the homepage quick-action tile
 * and sidebar item can deep-link directly to it.
 */
export default function PlanOverlapPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">When are we all free?</h1>
        <p className="text-sm text-muted-foreground">
          Pick your group — see which days everyone typically streams and where
          your schedules overlap. For a specific time block, try{" "}
          <a className="underline" href="/plan/with-friend">Plan with a friend</a>.
        </p>
      </div>
      <FindTimeView />
    </div>
  );
}
