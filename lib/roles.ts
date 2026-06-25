export type UserRole = "compliance_officer" | "risk_manager" | "counterparty" | "admin"

export const ROLE_LABELS: Record<UserRole, string> = {
  compliance_officer: "Officier de Conformité",
  risk_manager: "Gestionnaire des Risques",
  counterparty: "Contrepartie",
  admin: "Admin",
}

// Roles a user is allowed to pick themselves at sign-up (admin is excluded
// and must be assigned manually).
export const SELF_ASSIGNABLE_ROLES: UserRole[] = [
  "compliance_officer",
  "risk_manager",
]

export function getRoleLabel(role?: string | null): string {
  if (role && role in ROLE_LABELS) {
    return ROLE_LABELS[role as UserRole]
  }
  return ROLE_LABELS.compliance_officer
}

/**
 * A role is treated as a "counterparty profile" when its key or label mentions
 * counterparty (FR "contrepartie" / EN "counterparty"). Users holding such a
 * role can be linked to a specific counterparty record. This heuristic keeps
 * the dynamic role system flexible: an admin just creates a role named
 * "Contrepartie" and it is automatically recognized.
 */
export function isCounterpartyRole(role: { key: string; label?: string | null }): boolean {
  const haystack = `${role.key} ${role.label ?? ""}`.toLowerCase()
  return /contrepart|counterpart/.test(haystack)
}
