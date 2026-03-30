from __future__ import annotations

from redis.asyncio import Redis

from app.schemas.state import ConversationState


class RedisStateStore:
    def __init__(self, redis_client: Redis, ttl_seconds: int) -> None:
        self.redis_client = redis_client
        self.ttl_seconds = ttl_seconds

    @staticmethod
    def _key(salon_id: str, channel: str, external_user_id: str) -> str:
        return f"conv:{salon_id}:{channel}:{external_user_id}"

    async def get_state(
        self,
        salon_id: str,
        channel: str,
        external_user_id: str,
    ) -> ConversationState | None:
        raw_state = await self.redis_client.get(self._key(salon_id, channel, external_user_id))
        if not raw_state:
            return None
        return ConversationState.model_validate_json(raw_state)

    async def save_state(self, state: ConversationState) -> None:
        key = self._key(state.salon_id, state.channel.value, state.external_user_id)
        await self.redis_client.set(key, state.model_dump_json(), ex=self.ttl_seconds)

    async def clear_state(self, salon_id: str, channel: str, external_user_id: str) -> None:
        await self.redis_client.delete(self._key(salon_id, channel, external_user_id))
