/** Canonical customer-facing Home Services departments from PRODUCT_SCOPE.md. */
export const HOME_SERVICE_DEPARTMENTS = [
  { value: "SMART_HOME_INSTALLATIONS", label: "Smart Home Installations", description: "Solar installations, CCTV installations and security systems.", specialties: ["SOLAR", "CCTV", "SECURITY_SYSTEMS"] },
  { value: "LUXURY", label: "Luxury", description: "Painting and furniture services.", specialties: ["PAINTING", "FURNITURE"] },
  { value: "ELECTRICAL_PLUMBING", label: "Electrical & Plumbing", description: "Electrical and plumbing services for homes and properties.", specialties: ["ELECTRICAL", "PLUMBING"] },
  { value: "CLEANING_MOVE_IN", label: "Cleaning & Move-In", description: "Cleaning and move-in services for homes and properties.", specialties: ["CLEANING", "MOVE_IN"] },
  { value: "FUMIGATION_PEST_CONTROL", label: "Fumigation & Pest Control", description: "Fumigation and pest-control services.", specialties: ["FUMIGATION", "PEST_CONTROL"] },
] as const;

export type HomeServiceDepartment = (typeof HOME_SERVICE_DEPARTMENTS)[number]["value"];

/** Granular specialties used for provider verification, offerings and requests. */
export const HOME_SERVICE_SPECIALTIES = [
  { value: "SOLAR", label: "Solar installations", department: "SMART_HOME_INSTALLATIONS" },
  { value: "CCTV", label: "CCTV installations", department: "SMART_HOME_INSTALLATIONS" },
  { value: "SECURITY_SYSTEMS", label: "Security systems", department: "SMART_HOME_INSTALLATIONS" },
  { value: "PAINTING", label: "Painting", department: "LUXURY" },
  { value: "FURNITURE", label: "Furniture", department: "LUXURY" },
  { value: "ELECTRICAL", label: "Electrical", department: "ELECTRICAL_PLUMBING" },
  { value: "PLUMBING", label: "Plumbing", department: "ELECTRICAL_PLUMBING" },
  { value: "CLEANING", label: "Cleaning", department: "CLEANING_MOVE_IN" },
  { value: "MOVE_IN", label: "Move-In", department: "CLEANING_MOVE_IN" },
  { value: "FUMIGATION", label: "Fumigation", department: "FUMIGATION_PEST_CONTROL" },
  { value: "PEST_CONTROL", label: "Pest control", department: "FUMIGATION_PEST_CONTROL" },
] as const;

/** Existing records retain their granular category; this maps a department to the categories it contains. */
export function serviceCategoriesForDepartment(department: HomeServiceDepartment): string[] {
  return HOME_SERVICE_SPECIALTIES.filter((item) => item.department === department).map((item) => item.value);
}

export function serviceDepartmentLabel(value: string): string {
  const specialty = HOME_SERVICE_SPECIALTIES.find((item) => item.value === value);
  if (specialty) return specialty.label;
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
