import asyncio
import logging
import os
import socket
import time
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

class InMemoryFallbackCache:
    """An asynchronous in-memory cache fallback used when Redis is unreachable."""

    def __init__(self):
        self._data: dict[str, str] = {}
        self._expires: dict[str, float] = {}

    def _purge_expired(self, key: str) -> None:
        if key in self._expires and time.time() > self._expires[key]:
            self._data.pop(key, None)
            self._expires.pop(key, None)

    async def get(self, key: str) -> str | None:
        self._purge_expired(key)
        return self._data.get(key)

    async def set(self, key: str, value: str, ex: int | None) -> bool:
        self._data[key] = str(value)
        if ex is not None:
            self._expires[key] = time.time() + ex
        else:
            self._expires.pop(key, None)
        return True

    async def delete(self, *keys: str) -> int:
        count = 0
        for k in keys:
            if k in self._data:
                self._data.pop(k, None)
                self._expires.pop(k, None)
                count += 1
        return count

    async def exists(self, key: str) -> int:
        self._purge_expired(key)
        return 1 if key in self._data else 0

    async def incr(self, key: str) -> int:
        self._purge_expired(key)
        curr = int(self._data.get(key, 0)) + 1
        self._data[key] = str(curr)
        return curr

    async def expire(self, key: str, seconds: int) -> bool:
        if key in self._data:
            self._expires[key] = time.time() + seconds
            return True
        return False

    async def ttl(self, key: str) -> int:
        self._purge_expired(key)
        if key not in self._data:
            return -2
        if key not in self._expires:
            return -1
        remaining = int(self._expires[key] - time.time())
        return max(remaining, 0)

    async def ping(self) -> bool:
        return True

    async def aclose(self) -> None:
        self._data.clear()
        self._expires.clear()

class RedisClientManager:
    """Manages Async Redis client with transparent fallback to in-memory cache."""

    def __init__(self, url: str = REDIS_URL):
        self.url = url
        self._redis: Any = None
        self._fallback = InMemoryFallbackCache()
        self._using_fallback = not self._is_server_reachable()
        self._checked_connection = True
        if self._using_fallback:
            logger.info("Redis host at %s is not reachable. Using in-memory fallback cache.", self.url)

    def _is_server_reachable(self) -> bool:
        """Fast non-blocking check to verify if the Redis TCP socket is open."""
        try:
            # Step 1: Parse host and port from configured Redis URL
            parsed = urlparse(self.url)
            host = parsed.hostname or "127.0.0.1"
            if host == "localhost":
                host = "127.0.0.1"
            port = parsed.port or 6379
            # Step 2: Test raw TCP socket connection with a 100ms timeout
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.1)
                return s.connect_ex((host, port)) == 0
        except Exception:
            logger.error("")
            raise

    async def get_client(self) -> Any:
        try:
            # Step 1: Return in-memory fallback cache if remote Redis is unreachable
            if self._using_fallback:
                return self._fallback

            # Step 2: Return existing cached connection if already established
            if self._redis is not None:
                return self._redis
            import redis.asyncio as aioredis

            # Step 3: Configure SSL flags if rediss scheme is detected
            is_ssl = self.url.startswith("rediss://")
            ssl_kwargs = {"ssl_cert_reqs": None} if is_ssl else {}

            # Step 4: Connect to async Redis instance and verify with ping
            client = aioredis.from_url(
                self.url,
                decode_responses=True,
                socket_timeout=1.0,
                socket_connect_timeout=1.0,
                retry_on_timeout=False,
                **ssl_kwargs,
            )
            await asyncio.wait_for(client.ping(), timeout=1.0)
            self._redis = client
            logger.info("Connected to Redis successfully at %s", self.url)
            return self._redis

        except Exception as e:  # noqa: BLE001
            # Step 5: Fall back to in-memory async cache on failure
            logger.warning("Redis ping to %s failed (%s). Falling back to in-memory async cache.", self.url, e)
            self._using_fallback = True
            return self._fallback

    async def get(self, key: str) -> str | None:
        try:
            # Step 1: Retrieve key from Redis client
            client = await self.get_client()
            return await client.get(key)
        except Exception as e:  # noqa: BLE001
            # Step 2: Fall back to in-memory cache on error
            logger.error("Redis get failed for %s: %s, falling back to memory", key, e)
            return await self._fallback.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:
        try:
            # Step 1: Store key-value pair in Redis with optional expiration
            client = await self.get_client()
            return await client.set(key, value, ex=ex)
        except Exception as e:  # noqa: BLE001
            # Step 2: Fall back to in-memory cache on error
            logger.error("Redis set failed for %s: %s, falling back to memory", key, e)
            return await self._fallback.set(key, value, ex=ex)

    async def delete(self, *keys: str) -> int:
        try:
            # Step 1: Remove keys from Redis client
            if not keys:
                return 0
            client = await self.get_client()
            return await client.delete(*keys)
        except Exception as e:  # noqa: BLE001
            # Step 2: Fall back to in-memory cache on error
            logger.error("Redis delete failed for %s: %s, falling back to memory", keys, e)
            return await self._fallback.delete(*keys)

    async def exists(self, key: str) -> int:
        try:
            # Step 1: Query key existence in Redis
            client = await self.get_client()
            return await client.exists(key)
        except Exception as e:  # noqa: BLE001
            # Step 2: Fall back to in-memory cache on error
            logger.error("Redis exists failed for %s: %s, falling back to memory", key, e)
            return await self._fallback.exists(key)

    async def incr(self, key: str) -> int:
        try:
            # Step 1: Increment atomic counter in Redis
            client = await self.get_client()
            return await client.incr(key)
        except Exception as e:  # noqa: BLE001
            # Step 2: Fall back to in-memory counter on error
            logger.error("Redis incr failed for %s: %s, falling back to memory", key, e)
            return await self._fallback.incr(key)

    async def expire(self, key: str, seconds: int) -> bool:
        try:
            # Step 1: Set TTL expiration in Redis
            client = await self.get_client()
            return await client.expire(key, seconds)
        except Exception as e:  # noqa: BLE001
            # Step 2: Fall back to in-memory cache on error
            logger.error("Redis expire failed for %s: %s, falling back to memory", key, e)
            return await self._fallback.expire(key, seconds)

    async def ttl(self, key: str) -> int:
        try:
            # Step 1: Query remaining TTL from Redis
            client = await self.get_client()
            return await client.ttl(key)
        except Exception as e:  # noqa: BLE001
            # Step 2: Fall back to in-memory cache on error
            logger.error("Redis ttl failed for %s: %s, falling back to memory", key, e)
            return await self._fallback.ttl(key)

redis_client = RedisClientManager()
