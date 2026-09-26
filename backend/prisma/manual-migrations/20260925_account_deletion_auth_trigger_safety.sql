-- Store audit Block 2: keep Auth deletion from hard-deleting marketplace history.
--
-- The original trigger deleted public.users for unverified accounts whenever
-- auth.users was deleted. That is unsafe for the new account-erasure flow:
-- shared bids/sales/messages may reference public.users, and hard-deleting it
-- can cascade or fail after the Auth identity has already been removed.
--
-- Replace it with a fail-safe pseudonymisation trigger. The application
-- deletion service performs the broader Storage/KYC/transient-data cleanup.
-- This trigger guarantees that, even if a later application step fails after
-- Auth deletion, the core public.users PII is no longer usable as an account.
--
-- SECURITY DEFINER is required because the trigger executes from auth.users
-- and updates public.users. Direct API execution is explicitly revoked.

BEGIN;

DROP TRIGGER IF EXISTS carmazium_delete_unverified_local_user_after_auth_delete
ON auth.users;

DROP FUNCTION IF EXISTS public.carmazium_delete_unverified_local_user_after_auth_delete();

CREATE OR REPLACE FUNCTION public.carmazium_pseudonymize_local_user_after_auth_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.users
    SET
        "deletedAt" = COALESCE("deletedAt", now()),
        email = 'deleted-' || OLD.id::text || '@deleted.carmazium.com',
        "passwordHash" = 'ACCOUNT_DELETED',
        "firstName" = 'Deleted',
        "lastName" = 'User',
        phone = NULL,
        "profileImage" = NULL,
        "isEmailVerified" = false,
        "isPhoneVerified" = false,
        "isAddressVerified" = false,
        "addressVerifiedAt" = NULL,
        "bankAccountName" = NULL,
        "bankSortCode" = NULL,
        "bankAccountNumber" = NULL,
        "notifyOnSale" = false,
        "showPublicProfile" = false,
        location = NULL,
        postcode = NULL,
        preferences = '{}'::jsonb
    WHERE id = OLD.id::text;

    RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.carmazium_pseudonymize_local_user_after_auth_delete()
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.carmazium_pseudonymize_local_user_after_auth_delete()
FROM anon;

REVOKE ALL ON FUNCTION public.carmazium_pseudonymize_local_user_after_auth_delete()
FROM authenticated;

REVOKE ALL ON FUNCTION public.carmazium_pseudonymize_local_user_after_auth_delete()
FROM service_role;

CREATE TRIGGER carmazium_pseudonymize_local_user_after_auth_delete
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.carmazium_pseudonymize_local_user_after_auth_delete();

COMMIT;
