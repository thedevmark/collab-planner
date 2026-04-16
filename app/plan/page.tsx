// The canonical "plan a session" canvas. Workable Windows is the center of
// gravity here. Every planning entry point — picking people first, starting
// from a date, sharing a link — is a prefill or an in-canvas action rather
// than its own destination.
//
// This file re-exports the form component from /events/new so the two URLs
// render identically during the migration. Once every call site uses /plan,
// the /events/new route can be removed.
export { default } from "../events/new/page";
