/**
 * Utilities for extracting and normalizing member names across the application.
 */

export const MEMBER_NAME_KEYS = [
  "full_name",
  "fullName",
  "name",
  "member_name",
  "memberName",
  "director_name",
  "directorName",
  "partner_name",
  "partnerName",
  "shareholder_name",
  "shareholderName",
  "stakeholder_name",
  "stakeholderName",
  "promoter_name",
  "promoterName",
  "authorized_person_name",
  "authorizedPersonName"
];

/**
 * Extracts a display name from a member object.
 * Searches multiple potential name keys in details.
 */
export function getMemberDisplayName(member: any, roleName?: string, index?: number): string {
  if (!member) return "Unnamed Member";
  
  const details = member?.details || member || {};

  // 1. Try explicit keys
  for (const key of MEMBER_NAME_KEYS) {
    const val = details?.[key] || member?.[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }

  // 2. Fallback: search any key containing "name"
  const dynamicName = Object.entries(details).find(([key, val]) =>
    key.toLowerCase().includes("name") &&
    typeof val === "string" &&
    val.trim()
  )?.[1];

  if (typeof dynamicName === "string" && dynamicName.trim()) {
    return dynamicName.trim();
  }

  // 3. Fallback: use roleName and index
  if (roleName) {
    return `${roleName} Member ${typeof index === "number" ? index + 1 : ""}`.trim();
  }

  return "Unnamed Member";
}

/**
 * Ensures a member object has a full_name field in its details.
 */
export function ensureMemberNameField(details: Record<string, any>) {
  if (!details) return { full_name: "" };
  
  const hasName = getMemberDisplayName({ details }, "", undefined) !== "Unnamed Member";
  if (!hasName && !details.full_name) {
    details.full_name = "";
  }
  return details;
}

/**
 * Normalizes a member object before saving to ensure 'name' and 'displayName' are present.
 */
export function normalizeMemberForSave(member: any, roleName?: string, index?: number) {
  const displayName = getMemberDisplayName(member, roleName, index);
  
  // Extract actual name without role fallback for details.full_name
  const actualName = getMemberDisplayName(member, undefined, undefined);
  const finalFullName = (actualName !== "Unnamed Member") ? actualName : (member.details?.full_name || "");

  return {
    ...member,
    name: displayName,
    displayName: displayName,
    details: {
      ...(member.details || {}),
      full_name: finalFullName
    }
  };
}
