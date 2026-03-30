from __future__ import annotations

from fastapi import APIRouter

from app.api import appointments, public, webhooks, analytics, salons, users


api_router = APIRouter()
api_router.include_router(webhooks.router)
api_router.include_router(appointments.router)
api_router.include_router(public.router)
api_router.include_router(analytics.router)
api_router.include_router(salons.router)
api_router.include_router(users.router)
