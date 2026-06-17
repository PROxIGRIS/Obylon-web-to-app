export type UserRole = "dev" | "principal" | "admin" | "teacher" | "helper";

export type GavelCommand = "lock" | "terminate" | "freeze" | "unfreeze" | "kill_task" | "set_alias";

const ROLE_PERMISSIONS: Record<UserRole, GavelCommand[]> = {
  // You. Absolute sovereignty over the entire global infrastructure.
  dev: ["lock", "terminate", "freeze", "unfreeze", "kill_task", "set_alias"],
  
  // The King of the Castle. Absolute power over their specific school node.
  principal: ["lock", "terminate", "freeze", "unfreeze", "kill_task", "set_alias"],
  
  // The school IT guy (if they even have one). Maintenance access only.
  admin: ["lock", "freeze", "unfreeze", "kill_task", "set_alias"],
  
  // Frontline classroom management. Quick disciplinary actions.
  teacher: ["lock", "freeze", "unfreeze"],
  
  // Basic staff. Completely disarmed. Zero access to endpoint commands.
  helper: [], 
};

export function hasAuthority(role: string | null | undefined, command: GavelCommand): boolean {
  if (!role) return false;
  
  const normalizedRole = role.toLowerCase() as UserRole;
  return ROLE_PERMISSIONS[normalizedRole]?.includes(command) ?? false;
}

