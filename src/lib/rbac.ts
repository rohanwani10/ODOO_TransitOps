import { Role } from "./auth";

export type Resource = 
  | "vehicles" 
  | "drivers" 
  | "trips" 
  | "maintenance" 
  | "fuel-logs" 
  | "expenses" 
  | "reports" 
  | "users";

export type Action = "view" | "create" | "edit" | "delete" | "dispatch" | "suspend" | "export";

export interface Permission {
  resource: Resource;
  actions: Action[];
}

const permissionMatrix: Record<Role, Permission[]> = {
  FLEET_MANAGER: [
    { resource: "vehicles", actions: ["view", "create", "edit", "delete"] },
    { resource: "drivers", actions: ["view", "create", "edit", "delete", "suspend"] },
    { resource: "trips", actions: ["view", "create", "edit", "delete", "dispatch"] },
    { resource: "maintenance", actions: ["view", "create", "edit", "delete"] },
    { resource: "fuel-logs", actions: ["view", "create", "edit", "delete"] },
    { resource: "expenses", actions: ["view", "create", "edit", "delete"] },
    { resource: "reports", actions: ["view", "export"] },
    { resource: "users", actions: ["view", "create", "edit", "delete"] },
  ],
  DISPATCHER: [
    { resource: "vehicles", actions: ["view"] },
    { resource: "drivers", actions: ["view"] },
    { resource: "trips", actions: ["view", "create", "edit", "dispatch"] },
    { resource: "maintenance", actions: ["view"] },
    { resource: "fuel-logs", actions: ["view", "create"] },
    { resource: "expenses", actions: ["view", "create"] },
    { resource: "reports", actions: ["view"] },
    { resource: "users", actions: ["view"] },
  ],
  SAFETY_OFFICER: [
    { resource: "vehicles", actions: ["view", "edit"] },
    { resource: "drivers", actions: ["view", "edit", "suspend"] },
    { resource: "trips", actions: ["view"] },
    { resource: "maintenance", actions: ["view", "create", "edit"] },
    { resource: "fuel-logs", actions: ["view"] },
    { resource: "expenses", actions: ["view"] },
    { resource: "reports", actions: ["view"] },
    { resource: "users", actions: ["view"] },
  ],
  FINANCIAL_ANALYST: [
    { resource: "vehicles", actions: ["view"] },
    { resource: "drivers", actions: ["view"] },
    { resource: "trips", actions: ["view"] },
    { resource: "maintenance", actions: ["view"] },
    { resource: "fuel-logs", actions: ["view"] },
    { resource: "expenses", actions: ["view", "create", "edit"] },
    { resource: "reports", actions: ["view", "export"] },
    { resource: "users", actions: ["view"] },
  ],
};

/**
 * Checks if a role has permission to perform an action on a resource.
 */
export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  const rolePermissions = permissionMatrix[role];
  if (!rolePermissions) return false;

  const resourcePermission = rolePermissions.find((p) => p.resource === resource);
  if (!resourcePermission) return false;

  return resourcePermission.actions.includes(action);
}

/**
 * Returns all permissions for a given role.
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return permissionMatrix[role] || [];
}
