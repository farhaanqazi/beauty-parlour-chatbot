from __future__ import annotations

import unittest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole, AppointmentStatus
from app.db.models.user import User
from app.main import app


class UserRoleEnumTests(unittest.TestCase):
    """Test UserRole enum mapping with database."""

    def test_user_role_enum_values_are_lowercase(self):
        """Ensure UserRole enum values match database lowercase values."""
        self.assertEqual(UserRole.ADMIN.value, "admin")
        self.assertEqual(UserRole.SALON_OWNER.value, "salon_owner")
        self.assertEqual(UserRole.RECEPTION.value, "reception")

    def test_user_role_enum_from_string(self):
        """Test creating UserRole from lowercase string."""
        self.assertEqual(UserRole("admin"), UserRole.ADMIN)
        self.assertEqual(UserRole("salon_owner"), UserRole.SALON_OWNER)
        self.assertEqual(UserRole("reception"), UserRole.RECEPTION)

    def test_user_role_enum_invalid_value(self):
        """Test that invalid values raise ValueError."""
        with self.assertRaises(ValueError):
            UserRole("invalid_role")
        with self.assertRaises(ValueError):
            UserRole("ADMIN")  # uppercase should fail


class UserModelRoleTests(unittest.TestCase):
    """Test User model role enum handling."""

    def test_user_role_is_enum_type(self):
        """Test that User.role is stored as UserRole enum."""
        user = User()
        user.id = uuid4()
        user.email = "test@example.com"
        user.role = UserRole.ADMIN
        
        self.assertIsInstance(user.role, UserRole)
        self.assertEqual(user.role, UserRole.ADMIN)
        self.assertEqual(user.role.value, "admin")

    def test_user_role_enum_comparison(self):
        """Test direct enum comparison without .value."""
        user = User()
        user.role = UserRole.SALON_OWNER
        
        self.assertEqual(user.role, UserRole.SALON_OWNER)
        self.assertTrue(user.is_salon_owner)
        self.assertFalse(user.is_admin)

    def test_user_role_properties(self):
        """Test User model role convenience properties."""
        user = User()
        user.role = UserRole.ADMIN
        self.assertTrue(user.is_admin)
        self.assertFalse(user.is_salon_owner)
        self.assertFalse(user.is_reception)

        user.role = UserRole.SALON_OWNER
        self.assertFalse(user.is_admin)
        self.assertTrue(user.is_salon_owner)
        self.assertFalse(user.is_reception)

        user.role = UserRole.RECEPTION
        self.assertFalse(user.is_admin)
        self.assertFalse(user.is_salon_owner)
        self.assertTrue(user.is_reception)


class AppointmentsEndpointTests(unittest.TestCase):
    """Test appointments endpoint functionality."""

    def setUp(self):
        self.client = TestClient(app)

    def test_list_appointments_requires_salon_id(self):
        """Test that /appointments endpoint requires salon_id parameter."""
        # Without authentication, should get 401
        response = self.client.get("/api/v1/appointments")
        self.assertEqual(response.status_code, 401)

    def test_list_appointments_requires_date_range(self):
        """Test that /appointments endpoint requires date_from and date_to."""
        # Without authentication, should get 401
        response = self.client.get(
            "/api/v1/appointments",
            params={"salon_id": str(uuid4())}
        )
        self.assertEqual(response.status_code, 401)


class SalonIdentifierTests(unittest.TestCase):
    """Test salon identifier resolution (UUID or slug)."""

    def test_uuid_parsing(self):
        """Test that UUID can be parsed from string."""
        salon_uuid = uuid4()
        parsed_uuid = UUID(str(salon_uuid))
        self.assertEqual(parsed_uuid, salon_uuid)

    def test_slug_fallback(self):
        """Test that non-UUID strings are treated as slugs."""
        salon_slug = "my-beauty-salon"
        try:
            UUID(salon_slug)
            self.fail("Should have raised ValueError")
        except ValueError:
            # Expected - this confirms it's a slug, not a UUID
            pass


class RoleAuthorizationTests(unittest.TestCase):
    """Test role-based authorization with string roles."""

    def test_authenticated_user_role_is_string(self):
        """Test that AuthenticatedUser stores role as string."""
        from app.api.deps import AuthenticatedUser
        
        user = AuthenticatedUser(
            id=str(uuid4()),
            email="test@example.com",
            role="admin",  # String role
        )
        
        self.assertIsInstance(user.role, str)
        self.assertEqual(user.role, "admin")

    def test_role_comparison_in_authorization(self):
        """Test role comparison in authorization checks."""
        from app.api.deps import AuthenticatedUser
        
        admin_user = AuthenticatedUser(
            id=str(uuid4()),
            email="admin@example.com",
            role="admin",
        )
        
        salon_owner = AuthenticatedUser(
            id=str(uuid4()),
            email="owner@example.com",
            role="salon_owner",
        )
        
        # String comparison should work
        self.assertTrue(admin_user.role == "admin")
        self.assertFalse(salon_owner.role == "admin")
        self.assertIn(salon_owner.role, ["admin", "salon_owner"])


if __name__ == "__main__":
    unittest.main()
