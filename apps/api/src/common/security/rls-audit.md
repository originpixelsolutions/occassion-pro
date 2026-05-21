# OccasionPro — Row Level Security (RLS) Audit

**Last reviewed:** 2026-05-18  
**Reviewed by:** Security hardening pass (Task #182)  
**Status:** ✅ All tenant-scoped tables confirmed isolated

---

## Architecture Overview

OccasionPro uses a **service-role + application-layer** security model:

1. **Database Layer (Supabase RLS)**  
   All tables have RLS enabled. The service role key bypasses RLS by design — this is intentional and correct for a server-side API. The API server is the only trust boundary between users and the database.

2. **Application Layer (NestJS)**  
   Every request is authenticated via `AuthGuard` → Supabase JWT verification → profile lookup. The `profile.tenant_id` from the verified JWT is used in **every** database query. No user can query another tenant's data even if they supply a different tenant ID in the URL.

3. **Cross-Tenant Protection**  
   The `TenantMatchGuard` and `@CurrentTenant()` decorator enforce that the `:tenantId` URL parameter always matches the JWT's `tenant_id`. Super admins are the only exception.

---

## Key Security Invariants

### ✅ Service Role Key Usage
- **All API mutations use `supabase.getServiceClient()`** which carries the `service_role` JWT
- The `anon` key is **never used for mutations** in the API
- Anon key is only used in the Next.js frontend for Supabase Auth operations (login, OTP)
- Supabase `SupabaseService.getServiceClient()` is the sole factory for server-side clients

### ✅ Tenant Isolation Pattern
Every table that stores tenant data has:
```sql
tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
```
Every service query pattern:
```typescript
// SECURITY: All queries use Supabase parameterized client — no raw SQL interpolation
const { data } = await sb
  .from('events')
  .select('*')
  .eq('tenant_id', tenantId)   // <-- always filtered by JWT tenant
  .eq('id', eventId)
```

### ✅ No Raw SQL Interpolation
- All queries use Supabase's `.from().select().eq()` parameterized chain
- The `supabase-js` client never interpolates user input into SQL strings
- RPCs (`.rpc()`) use named parameters: `{ params: { p_tenant_id: tenantId } }`
- `exports.service.ts`, `intelligence.service.ts`, `runsheet.service.ts` confirmed ✓

---

## Table Inventory

### Core Platform Tables

| Table | RLS Enabled | Tenant-Scoped | Notes |
|-------|-------------|---------------|-------|
| `tenants` | ✅ | Self-referential | Each tenant only sees its own row |
| `profiles` | ✅ | Via `tenant_id` | Users only see profiles in their tenant |
| `events` | ✅ | `tenant_id` | + Event-level access control (migration 053) |
| `event_team_members` | ✅ | Via `event_id` | Event access guard validates membership |
| `guests` | ✅ | `tenant_id` | |
| `guest_invitations` | ✅ | `tenant_id` | |
| `guest_rsvps` | ✅ | Via `invitation_id` | |
| `guest_accommodation` | ✅ | `tenant_id` | |

### Financial Tables

| Table | RLS Enabled | Tenant-Scoped | Notes |
|-------|-------------|---------------|-------|
| `event_budgets` | ✅ | `tenant_id` | |
| `invoices` | ✅ | `tenant_id` | |
| `invoice_line_items` | ✅ | Via `invoice_id` | |
| `payments` | ✅ | `tenant_id` | |
| `payment_transactions` | ✅ | `tenant_id` | |
| `expenses` | ✅ | `tenant_id` | |
| `tenant_payment_gateways` | ✅ | `tenant_id` | Config column AES-256-GCM encrypted |

### CRM Tables

| Table | RLS Enabled | Tenant-Scoped | Notes |
|-------|-------------|---------------|-------|
| `clients` | ✅ | `tenant_id` | |
| `crm_leads` | ✅ | `tenant_id` | |
| `proposals` | ✅ | `tenant_id` | |
| `crm_activities` | ✅ | `tenant_id` | |

### Vendor / Team Tables

| Table | RLS Enabled | Tenant-Scoped | Notes |
|-------|-------------|---------------|-------|
| `vendors` | ✅ | `tenant_id` | |
| `vendor_contracts` | ✅ | `tenant_id` | |
| `team_members` | ✅ | `tenant_id` | |
| `team_invitations` | ✅ | `tenant_id` | |
| `shifts` | ✅ | `tenant_id` | |
| `vendor_portal_sessions` | ✅ | `tenant_id` | |

### Portal Tables

| Table | RLS Enabled | Tenant-Scoped | Notes |
|-------|-------------|---------------|-------|
| `guest_portal_sessions` | ✅ | `tenant_id` | OTP single-use enforced in service |
| `client_portal_sessions` | ✅ | `tenant_id` | Magic link single-use enforced |
| `client_portal_magic_links` | ✅ | `tenant_id` | `is_used=true` on consumption |

### Security Tables (Migration 081)

| Table | RLS Enabled | Notes |
|-------|-------------|-------|
| `auth_attempts` | ✅ | Service role write-only. No read via API. |
| `used_webhook_nonces` | ✅ | Service role write-only. |
| `security_audit_log` | ✅ | Service role write. Tenant admins can read their own. |
| `field_encryption_key_versions` | ✅ | Service role only. |

### API / Integration Tables

| Table | RLS Enabled | Tenant-Scoped | Notes |
|-------|-------------|---------------|-------|
| `api_keys` | ✅ | `tenant_id` | Stored as SHA-256 hashes, never plaintext |
| `webhook_subscriptions` | ✅ | `tenant_id` | |
| `webhook_deliveries` | ✅ | `tenant_id` | |
| `tenant_custom_domains` | ✅ | `tenant_id` | Verification tokens in metadata JSONB |

### Subscription / Plan Tables

| Table | RLS Enabled | Tenant-Scoped | Notes |
|-------|-------------|---------------|-------|
| `subscription_plans` | ✅ | Public read (plans are global) | |
| `tenant_subscriptions` | ✅ | `tenant_id` | |
| `usage_records` | ✅ | `tenant_id` | |

---

## Magic Link / OTP Single-Use Enforcement

### Client Portal Magic Links
```typescript
// In client-portal.service.ts — consumeMagicLink()
await sb.from('client_portal_magic_links')
  .update({ is_used: true, used_at: new Date().toISOString() })
  .eq('token', token)
  .eq('is_used', false)  // Atomic: only consumes if not already used
  .single()
```
**Result:** A magic link can only be consumed once. Replaying the same URL returns 401.

### Guest Portal OTP
```typescript
// In guest-portal.service.ts — verifyOtp()
// OTP is deleted on successful verification (not just marked used)
await sb.from('guest_portal_sessions')
  .delete()
  .eq('otp_hash', hash(otp))
  .eq('guest_id', guestId)
```
**Result:** OTP is single-use and expires after TTL (15 minutes).

---

## API Key Security

```typescript
// In external-api.service.ts — createApiKey()
const rawKey = generateSecureKey()       // 32 random bytes hex
const keyHash = sha256(rawKey)           // SHA-256 hash stored in DB
// rawKey shown ONCE to user, never stored
await sb.from('api_keys').insert({ key_hash: keyHash, ... })
```
**Result:** Raw API keys are never stored. Only SHA-256 hashes in DB. A database breach doesn't expose usable keys.

---

## Webhook Signature Verification

**BEFORE this task (UNSAFE — timing attack vulnerable):**
```typescript
if (receivedSig === expectedSig) { // ❌ string === timing leak
```

**AFTER (SAFE — timing-safe comparison):**
```typescript
import { timingSafeEqual } from 'crypto'
// Hash both to equal length, then compare
const hashA = createHmac('sha256', 'key').update(a).digest()
const hashB = createHmac('sha256', 'key').update(b).digest()
return timingSafeEqual(hashA, hashB) // ✅ constant-time
```

---

## Field Encryption

Sensitive columns encrypted with AES-256-GCM via `FieldEncryptionService`:

| Table.Column | What's Stored |
|---|---|
| `tenant_payment_gateways.config` | API keys, webhook secrets, merchant IDs |
| `tenant_custom_domains.metadata` | Cloudflare hostname IDs |
| `integrations.credentials` | OAuth access/refresh tokens, API secrets |
| `messaging.whatsapp_session_data` | WhatsApp Baileys session keys |

Wire format: `Base64([12B IV][16B AuthTag][NB Ciphertext])`  
Key source: `FIELD_ENCRYPTION_KEY` env var (64 hex chars = 32 bytes)  
Key rotation: increment `field_encryption_key_versions.version`, re-encrypt affected rows offline.

---

## Known Limitations & Future Work

1. **Row-level read policies for tenant admins**: Currently all reads bypass RLS via service role. Consider adding Supabase anon policies for specific low-risk tables to enable direct client queries (reduces API round-trips).

2. **Key Management**: `FIELD_ENCRYPTION_KEY` is currently env-var based. For production, migrate to AWS KMS / GCP Cloud KMS / HashiCorp Vault with envelope encryption.

3. **Audit log retention**: Currently unbounded. Implement pg_partman monthly partitioning for `security_audit_log` once it exceeds ~1M rows.

4. **RBAC enforcement at DB layer**: Currently enforced at service layer only. Future: implement PostgreSQL row-level policies that mirror the NestJS RBAC roles for defense-in-depth.

5. **Supabase Storage RLS**: `exports`, `branding`, `media` buckets need explicit bucket-level policies reviewed. Confirm no public-read buckets contain sensitive data.
