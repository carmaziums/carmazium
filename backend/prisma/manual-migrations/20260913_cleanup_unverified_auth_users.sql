-- Keep Supabase Auth and the CarMazium public user row in sync when an
-- abandoned, unverified signup is removed by the scheduled backend cleanup.
--
-- This trigger deliberately deletes ONLY local rows that are still unverified.
-- Verified users are never touched by this trigger.
--
-- The scheduled cleanup calls Supabase Auth Admin deleteUser(). Because this is
-- an AFTER DELETE trigger on auth.users, deleting the auth identity and the
-- matching public.users row happens in the same database transaction. If a
-- foreign-key constraint prevents the local row from being removed, the auth
-- deletion fails too instead of leaving a half-deleted account.

BEGIN;

CREATE OR REPLACE FUNCTION public.carmazium_delete_unverified_local_user_after_auth_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.users
    WHERE id = OLD.id::text
      AND "isEmailVerified" = false;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS carmazium_delete_unverified_local_user_after_auth_delete
ON auth.users;

CREATE TRIGGER carmazium_delete_unverified_local_user_after_auth_delete
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.carmazium_delete_unverified_local_user_after_auth_delete();

COMMIT;
