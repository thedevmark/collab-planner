export const PARTICIPANT_RESPONSE_STATUSES = ["pending", "accepted", "declined"] as const;
export const LEGACY_PARTICIPANT_RESPONSE_STATUSES = ["confirmed", "cannot"] as const;
export const PARTICIPANT_RESPONSE_STATUS_INPUTS = [
  ...PARTICIPANT_RESPONSE_STATUSES,
  ...LEGACY_PARTICIPANT_RESPONSE_STATUSES,
] as const;

export type ParticipantResponseStatus = typeof PARTICIPANT_RESPONSE_STATUSES[number];
export type ParticipantResponseStatusInput = typeof PARTICIPANT_RESPONSE_STATUS_INPUTS[number];
export type ParticipantResponseBadgeVariant = "success" | "destructive" | "secondary";

type ParticipantWithInviteStatus = {
  inviteStatus: string | null | undefined;
};

export function normalizeParticipantResponseStatus(
  status: string | null | undefined,
): ParticipantResponseStatus {
  if (status === "accepted" || status === "confirmed") return "accepted";
  if (status === "declined" || status === "cannot") return "declined";
  return "pending";
}

export function nextParticipantResponseStatus(
  status: string | null | undefined,
): ParticipantResponseStatus {
  const normalized = normalizeParticipantResponseStatus(status);
  if (normalized === "pending") return "accepted";
  if (normalized === "accepted") return "declined";
  return "pending";
}

export function participantResponseBadgeVariant(
  status: string | null | undefined,
): ParticipantResponseBadgeVariant {
  const normalized = normalizeParticipantResponseStatus(status);
  if (normalized === "accepted") return "success";
  if (normalized === "declined") return "destructive";
  return "secondary";
}

export function participantResponseLabel(status: string | null | undefined): string {
  const normalized = normalizeParticipantResponseStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function normalizeParticipantInviteStatus<T extends ParticipantWithInviteStatus>(
  participant: T,
): Omit<T, "inviteStatus"> & { inviteStatus: ParticipantResponseStatus } {
  return {
    ...participant,
    inviteStatus: normalizeParticipantResponseStatus(participant.inviteStatus),
  };
}

export function normalizeParticipantsInviteStatus<T extends ParticipantWithInviteStatus>(
  participants: T[],
): Array<Omit<T, "inviteStatus"> & { inviteStatus: ParticipantResponseStatus }> {
  return participants.map(normalizeParticipantInviteStatus);
}
