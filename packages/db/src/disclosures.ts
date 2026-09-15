export const DISCLOSURE_CHANNELS = [
  "print",
  "export",
  "email",
  "fax",
  "portal",
  "sms",
  "ai",
] as const;

export type DisclosureChannel = (typeof DISCLOSURE_CHANNELS)[number];

/** Purpose distinguishes TPO disclosures from those that belong in a 164.528 report. */
export const DISCLOSURE_PURPOSES = [
  "treatment",
  "payment",
  "operations",
  "export",
  "patient_request",
  "legal",
] as const;

export type DisclosurePurpose = (typeof DISCLOSURE_PURPOSES)[number];

export function isDisclosureChannel(value: string): value is DisclosureChannel {
  return (DISCLOSURE_CHANNELS as readonly string[]).includes(value);
}

export function isDisclosurePurpose(value: string): value is DisclosurePurpose {
  return (DISCLOSURE_PURPOSES as readonly string[]).includes(value);
}
