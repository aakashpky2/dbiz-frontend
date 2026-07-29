
import type { Profile } from "@/hooks/use-profiles";
import type { Employee } from "@/app/dashboard/employee-management/offer-letter/page";
import { type BusinessTypeSetup } from '@/hooks/use-profiles';

export function getSourceRootObject(
  source: string,
  sample: {
    employee?: any;
    profile?: any;
    constitution?: any;
    combined?: any; // if you want
  }
): any {
  // Accept nested sources like "profile.roles"
  const [root, ...rest] = (source || "").split(".").filter(Boolean);
  let base: any;

  switch (root) {
    case "employee":
    case "employees":
      base = sample.employee ?? {};
      break;
    case "profile":
    case "profiles":
      base = sample.profile ?? {};
      break;
    case "constitution":
    case "business_constitutions":
      base = sample.constitution ?? {};
      break;
    case "combined":
      base = sample.combined ?? {};
      break;
    default:
      base = {};
  }

  // if a list sneaks in, take one exemplar only
  if (Array.isArray(base)) base = base.find(Boolean) || {};

  // descend further for nested sources typed by user (e.g. "profile.roles")
  return rest.reduce((acc, key) => (acc && acc[key] != null ? acc[key] : {}), base);
}
