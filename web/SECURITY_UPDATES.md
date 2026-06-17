# Security & Settings Updates

A comprehensive log of the security hardening and settings features recently implemented in the Obylon by Umbraxis platform.

## 🔐 Authentication & Access

*   **Biometric & Hardware Key Support (Passkeys):** 
    *   Added a brutalist, one-click "Biometric / Hardware Key Access" button to the `/login` portal.
    *   Operators can securely register and manage WebAuthn-compatible passkeys directly from the Security Settings panel for phishing-resistant logins.
*   **Secure Re-authentication:** 
    *   Implemented a `ReauthModal` to protect sensitive actions. Operators must verify their current password before executing high-privilege operations such as revoking devices or changing credentials.

## 💻 Active Session Management

*   **Device Tracking:** 
    *   The Security Settings panel now features an "Active Sessions" tracker.
    *   Logs the operator's current and remote devices, including contextual data like OS/Browser, approximate IP-based location, and last active timestamps.
*   **Session Lifecycle & Recycling:**
    *   Resolved duplicate session bugs. Logging back in from a revoked device securely recycles the existing device footprint (`local_session_id`) rather than generating ghost sessions.

## ⚡ Real-Time Device Revocation

*   **Instant Ejection:** 
    *   Operators can selectively revoke individual remote devices or execute a "Revoke All Other Sessions" command.
    *   Powered by Supabase Realtime (`postgres_changes` on `user_sessions`), target devices are immediately ejected the exact millisecond their session is revoked.
*   **The `/revoked` Portal:** 
    *   Revoked devices are instantly routed to a dedicated, brutalist `/revoked` screen (mirroring the aesthetics of the `/banned` terminal) preventing further application access until acknowledged.
*   **Undo Revocation:** 
    *   Administrators/Operators can instantly "undo" a revocation, restoring real-time access to the target device seamlessly.

## 🛡️ Auditing & Telemetry

*   **Security Audit Logs:** 
    *   All highly sensitive actions (password changes, passkey registrations, remote session terminations) are now strictly logged in the `security_audit_logs` table.
    *   Fixed RLS (Row Level Security) silent failures to ensure immutable, operator-attributed audit trails.
*   **Edge Function Alerts:** 
    *   Integrated the `send-alert-email` Edge Function to handle automated, securely-templated email notifications for critical security events, respecting operator notification preferences.

---
*Obylon Administration // Security Verification*
