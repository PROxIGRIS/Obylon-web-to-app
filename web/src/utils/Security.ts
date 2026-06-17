// Centralized authority matrix for Gavel commands.
// Mirrors the RLS hierarchy so the UI never offers a command the DB will reject.
import type { GavelCommand } from "@/components/sentinel/GavelButton";

export type AppRole = "dev" | "admin" | "principal" | "teacher" | "helper" | null;

const MATRIX: Record<Exclude<AppRole, null>, GavelCommand[]> = {
  dev:       ["lock", "freeze", "unfreeze", "kill_task", "set_alias", "terminate"],
  admin:     ["lock", "freeze", "unfreeze", "kill_task", "set_alias", "terminate"],
  principal: ["lock", "freeze", "unfreeze", "kill_task", "set_alias", "terminate"],
  teacher:   ["freeze", "unfreeze"],
  helper:    [],
};

export function hasAuthority(role: AppRole, command: GavelCommand): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(command) ?? false;
}
