# VIP End-to-End Testing Roadmap — CPgestao-fidelidadeV1

This document outlines the step-by-step verification of the VIP Card lifecycle and terminal security features.

## Step 1: Admin — Batch Generation & Export
- **Action**: Access Admin Panel -> Tenants -> Select Tenant -> "Gerar Lote Premium".
- **Verification**: Batch is created in the list.
- **Action**: Click "Exportar CSV".
- **Verification**: Browser downloads a CSV file containing unique UIDs.
- **Backend check**: Table `device_batches` has a newer entry; `devices` has new UIDs with `status = 'available'`.

## Step 2: Client — Linking Device to Customer
- **Action**: Access Merchant Panel -> Contacts -> Select a Customer -> "Vincular Dispositivo".
- **Action**: Paste a UID from the exported CSV.
- **Verification**: Customer profile now shows "VIP/Premium" status.
- **Security Check**: Attempt to link the same UID to another customer (expect error).
- **Backend check**: `devices.status` is now `linked`; `devices.linked_customer_id` is set; `customers.is_premium` is `true`.

## Step 3: Public Terminal — Sanity & Sanitization
- **Action**: Open Public Terminal URL (`/loja-teste/{uid}`).
- **Verification**: 
    - If `uid` is linked: Input field shows `prefill_phone`.
    - If `uid` is unlinked premium or totem: `prefill_phone` is `null` (Sanitization Rule).
    - If `uid` is invalid/fake: Returns **404 Not Found** (Security Rule).

## Step 4: Loyalty Loop — Earn & Redeem
- **Action**: In the Terminal, type phone and correct PIN.
- **Action**: Click "Pontuar".
- **Verification**: Points increase. 
    - **Anti-Fraud**: Try to "Pontuar" again in less than 60s (expect 429 error).
- **Action**: Reach the points goal and click "Resgatar".
- **Verification**: points balance correctly deducted.

## Step 5: Client — Unlinking & Status Reset
- **Action**: Merchant Panel -> Contacts -> Remove Device link.
- **Verification**: Customer's "is_premium" status automatically switches to `false` (assuming it was their only linked device).
- **Backend check**: `devices.status` is `assigned`; `devices.linked_customer_id` is `null`.

## Step 6: Multi-tenant Lockdown
- **Action**: (Manual API) Attempt to access `/api/client/contacts/{id}` using a token from a DIFFERENT tenant.
- **Verification**: Response is **404 Not Found** (Multi-tenant Leak Protection).
