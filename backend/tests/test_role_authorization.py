from __future__ import annotations

import unittest

from fastapi import HTTPException

from app.api.deps import AuthenticatedUser, require_role, require_roles


def _user(role: str) -> AuthenticatedUser:
    return AuthenticatedUser(
        id="00000000-0000-0000-0000-000000000001",
        email="x@example.com",
        role=role,
        salon_id="00000000-0000-0000-0000-000000000002",
    )


class RequireRolesTests(unittest.IsolatedAsyncioTestCase):
    """Multi-role allowlist factory."""

    async def test_first_allowed_role_passes_and_returns_user(self):
        checker = require_roles("admin", "salon_owner")
        user = _user("admin")
        result = await checker(user=user)
        self.assertIs(result, user)

    async def test_other_allowed_role_passes(self):
        checker = require_roles("admin", "salon_owner")
        user = _user("salon_owner")
        result = await checker(user=user)
        self.assertIs(result, user)

    async def test_disallowed_role_raises_403(self):
        checker = require_roles("admin")
        user = _user("reception")
        with self.assertRaises(HTTPException) as ctx:
            await checker(user=user)
        self.assertEqual(ctx.exception.status_code, 403)

    async def test_403_detail_lists_required_roles(self):
        checker = require_roles("admin", "salon_owner")
        user = _user("reception")
        with self.assertRaises(HTTPException) as ctx:
            await checker(user=user)
        self.assertIn("admin", ctx.exception.detail)
        self.assertIn("salon_owner", ctx.exception.detail)

    async def test_empty_allowlist_locks_everyone_out(self):
        # Defensive: an accidentally-empty allowlist must NOT fail-open.
        checker = require_roles()
        with self.assertRaises(HTTPException) as ctx:
            await checker(user=_user("admin"))
        self.assertEqual(ctx.exception.status_code, 403)

    async def test_unknown_role_string_is_rejected(self):
        # A user constructed with an unrecognized role can't slip past.
        checker = require_roles("admin", "salon_owner", "reception")
        with self.assertRaises(HTTPException) as ctx:
            await checker(user=_user("super_admin"))
        self.assertEqual(ctx.exception.status_code, 403)


class RequireRoleTests(unittest.IsolatedAsyncioTestCase):
    """Single-role variant."""

    async def test_matching_role_passes(self):
        user = _user("admin")
        result = await require_role("admin", user=user)
        self.assertIs(result, user)

    async def test_non_matching_role_raises_403(self):
        user = _user("reception")
        with self.assertRaises(HTTPException) as ctx:
            await require_role("admin", user=user)
        self.assertEqual(ctx.exception.status_code, 403)

    async def test_role_match_is_case_sensitive(self):
        # Roles are stored as DB enum values (lowercase). A case-mismatched
        # role must NOT pass — defends against accidental tolower() drift.
        user = _user("admin")
        with self.assertRaises(HTTPException) as ctx:
            await require_role("Admin", user=user)
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
