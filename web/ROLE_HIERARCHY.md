# Obylon by Umbraxis: Role & Authorization Hierarchy

This document outlines the Role-Based Access Control (RBAC) hierarchy and permissions model within the Obylon grid. Access is strictly segmented into four tiers, defined by the `app_role` PostgreSQL enum.

---

## 🏛️ Tier 1: The Architect (God Mode)
**Roles:** `dev`

The absolute highest authority in the system. The `dev` role bypasses all standard administrative restrictions and is designed exclusively for system architects and core platform engineers.

**Privileges:**
*   **Role Management:** Can assign, modify, or revoke *any* role across the entire system (including other `dev` roles, `admin`, `principal`, `teacher`, and `helper`).
*   **Grid Oversight:** Can view all user profiles across the entire grid.
*   **Ban Hammer:** Full authority to instantly ban any operator from the platform or lift active bans.
*   **Telemetry Access:** Full access to all security audit logs, including hardware panics and session metadata.

---

## 🛡️ Tier 2: Administration Command
**Roles:** `admin`, `principal`

High-level organizational leaders. These roles govern the day-to-day operations and security of the operators within the grid, but their authority cannot override Tier 1.

**Privileges:**
*   **Subordinate Management:** Can assign, modify, or revoke roles for Tier 3 personnel only (`teacher`, `helper`). They cannot promote users to `admin` or `dev`.
*   **Grid Oversight:** Can view all user profiles across the grid.
*   **Security Enforcement:** Authorized to ban non-administrative users and process/approve/reject incoming unban requests from penalized operators.

---

## 📋 Tier 3: Standard Staff
**Roles:** `teacher`, `helper`

Elevated operational personnel who carry out daily functions but lack destructive or administrative privileges.

**Privileges:**
*   **Elevated Access:** Can bypass standard "new user" restrictions and interact with primary application resources.
*   *Restrictions:* Cannot ban users, process unban requests, or assign roles to other operators.

---

## 👤 Tier 4: The Operator (Base Level)
**Roles:** `user`, `null` (Unassigned)

The baseline access level. New accounts default to an unassigned state and must be provisioned a role by an Administrator before gaining access to the primary dashboard.

**Privileges:**
*   **Self-Management:** Can manage their own active biometric passkeys, change passwords, and revoke active remote sessions on their account.
*   **Appeals:** If banned, they are restricted to a brutalist `/banned` terminal, where they can view the reason for their ban and submit an appeal to Tier 2+ administrators.
*   *Restrictions:* Cannot view other profiles, view audit logs, or perform any administrative actions.

---

## ⚙️ Row-Level Security (RLS) Implementation
All hierarchical rules are strictly enforced at the database level using Postgres Row-Level Security. Specifically, the custom `public.has_any_role(auth.uid(), ARRAY['...'])` function is evaluated on every single `INSERT`, `UPDATE`, and `DELETE` operation before any row is committed to disk. 
