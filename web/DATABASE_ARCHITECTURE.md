# Database Architecture

## Enums
- **app_role**: admin, moderator, user
- **workstation_status**: online, offline
- **alert_severity**: info, warning, medium, high, critical
- **admin_command**: lock, terminate, freeze, unfreeze, kill_task, set_alias
- **action_status**: pending, sent, acknowledged, failed, completed

## Tables
### activity_logs
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| workstation_id | `uuid` | Yes | None |
| process_name | `text` | Yes | None |
| window_title | `text` | Yes | None |
| severity | `text` | Yes | None |
| is_anomaly | `boolean` | Yes | None |
| is_backlogged | `boolean` | Yes | None |
| created_at | `timestamp with time zone` | Yes | now() |

### admin_actions
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| command | `public.admin_command` | No | None |
| target_id | `uuid` | Yes | None |
| status | `public.action_status` | No | pending |
| issued_by | `uuid` | Yes | None |
| metadata | `jsonb` | Yes | None |
| created_at | `timestamp with time zone` | No | now() |
| completed_at | `timestamp with time zone` | Yes | None |

### agent_configs
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| agent_id | `uuid` | No | None |
| log_only_mode | `boolean` | No | true |
| strict_warden | `boolean` | No | None |
| updated_at | `timestamp with time zone` | No | timezone('utc'::text, now()) |

### agent_health
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| workstation_id | `text` | Yes | None |
| status | `text` | Yes | None |
| error_log | `text` | Yes | None |
| created_at | `timestamp with time zone` | Yes | now() |

### alerts
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| workstation_id | `uuid` | Yes | None |
| process_name | `text` | Yes | None |
| window_title | `text` | Yes | None |
| severity | `public.alert_severity` | No | info |
| timestamp | `timestamp with time zone` | No | now() |
| is_backlogged | `boolean` | Yes | None |
| created_at | `timestamp with time zone` | Yes | now() |

### allowed_apps
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| name | `text` | No | None |
| process_name | `text` | No | None |
| category | `text` | Yes | None |
| icon | `text` | Yes | None |
| whitelisted | `boolean` | No | None |
| created_at | `timestamp with time zone` | No | now() |
| updated_at | `timestamp with time zone` | No | now() |

### banned_users
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| user_id | `uuid` | No | None |
| banned_by | `uuid` | Yes | None |
| reason | `text` | Yes | None |
| created_at | `timestamp with time zone` | No | now() |

### evidence_logs
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| alert_id | `uuid` | Yes | None |
| screenshot_url | `text` | Yes | None |
| webcam_url | `text` | Yes | None |
| metadata | `jsonb` | Yes | None |
| is_backlogged | `boolean` | Yes | None |
| created_at | `timestamp with time zone` | No | now() |

### heartbeat_logs
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| workstation_id | `uuid` | Yes | None |
| uptime | `bigint` | Yes | None |
| created_at | `timestamp with time zone` | No | now() |

### licenses
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| token | `uuid` | No | gen_random_uuid() |
| school_name | `text` | No | None |
| max_nodes | `integer` | No | None |
| expires_at | `timestamp with time zone` | No | None |
| is_active | `boolean` | Yes | true |
| created_at | `timestamp with time zone` | Yes | now() |

### profiles
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| user_id | `uuid` | No | None |
| email | `text` | Yes | None |
| display_name | `text` | Yes | None |
| created_at | `timestamp with time zone` | No | now() |
| updated_at | `timestamp with time zone` | No | now() |
| avatar_url | `text` | Yes | None |
| is_banned | `boolean` | Yes | None |

### system_settings
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `integer` | No | 1 |
| focus_mode | `boolean` | No | None |
| updated_at | `timestamp with time zone` | No | now() |

### unauthorized_events
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| workstation_id | `uuid` | Yes | None |
| process_name | `text` | No | None |
| window_title | `text` | Yes | None |
| kind | `text` | No | None |
| timestamp | `timestamp with time zone` | No | now() |
| last_seen | `timestamp with time zone` | No | now() |
| duration_seconds | `integer` | No | None |
| payload | `text` | Yes | None |
| created_at | `timestamp with time zone` | No | now() |

### unauthorized_window_settings
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `integer` | No | 1 |
| start_at | `timestamp with time zone` | No | None |
| end_at | `timestamp with time zone` | No | None |
| clear_at | `timestamp with time zone` | No | None |
| clear_delay_seconds | `integer` | No | 1800 |
| updated_at | `timestamp with time zone` | No | now() |

### unban_requests
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| user_id | `uuid` | No | None |
| reason | `text` | No | None |
| status | `text` | No | pending |
| created_at | `timestamp with time zone` | No | now() |
| resolved_at | `timestamp with time zone` | Yes | None |
| resolved_by | `uuid` | Yes | None |

### user_roles
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| user_id | `uuid` | No | None |
| role | `public.app_role` | No | None |
| created_at | `timestamp with time zone` | No | now() |

### workstations
| Column | Type | Nullable | Default |
| ------ | ---- | -------- | ------- |
| id | `uuid` | No | gen_random_uuid() |
| name | `text` | No | None |
| status | `public.workstation_status` | No | offline |
| last_heartbeat | `timestamp with time zone` | Yes | None |
| hardware_uuid | `uuid` | Yes | None |
| os_info | `jsonb` | Yes | None |
| ip_address | `text` | Yes | None |
| allowed_app | `text` | Yes | None |
| current_window | `text` | Yes | None |
| current_process | `text` | Yes | None |
| created_at | `timestamp with time zone` | No | now() |
| updated_at | `timestamp with time zone` | No | now() |
| license_token | `uuid` | Yes | None |

## Relationships
- user_roles.user_id -> auth.users.id
- profiles.user_id -> auth.users.id
- alerts.workstation_id -> public.workstations.id
- evidence_logs.alert_id -> public.alerts.id
- admin_actions.target_id -> public.workstations.id
- admin_actions.issued_by -> auth.users.id
- activity_logs.workstation_id -> public.workstations.id
- device_tokens.user_id -> auth.users.id
