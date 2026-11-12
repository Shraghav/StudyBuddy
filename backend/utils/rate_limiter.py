import logging
import time
from uuid import UUID

from fastapi import Depends, HTTPException, status

from utils.caching.redis_client import redis_client
from utils.jwt_utils import get_current_user

logger = logging.getLogger(__name__)

DEFAULT_RATE_LIMIT = 20  
DEFAULT_WINDOW_SECONDS = 60 


class RateLimiter:
    """Dependency-based rate limiter enforcing request quotas per authenticated user using Redis."""

    def __init__(self, limit: int = DEFAULT_RATE_LIMIT, window_seconds: int = DEFAULT_WINDOW_SECONDS, scope: str = "default"):
        self.limit = limit
        self.window_seconds = window_seconds
        self.scope = scope

    async def __call__(self, user_id: UUID = Depends(get_current_user)) -> UUID:  # noqa: B008
        # Step 1: Enforce configured request quota for the authenticated user
        await enforce_rate_limit(scope=self.scope, user_id=user_id, limit=self.limit, window_seconds=self.window_seconds)
        # Step 2: Return validated user_id to downstream route handler
        return user_id


async def enforce_rate_limit(scope:str,user_id: UUID, limit: int = DEFAULT_RATE_LIMIT, window_seconds: int = DEFAULT_WINDOW_SECONDS) -> None:
    """Checks and increments rate limit counter for a user.

    Raises:
        HTTPException: 429 Too Many Requests if quota is exceeded.
    """
    try:
        # Step 1: Compute time-window bucket key for fixed-window rate limiting
        now = int(time.time())
        window_bucket = now // window_seconds
        key = f"rate_limit:{scope}:{user_id}:{window_bucket}"

        # Step 2: Increment atomic counter in Redis and set expiration window on first hit
        current_count = await redis_client.incr(key)
        if current_count == 1:
            await redis_client.expire(key, window_seconds)

        # Step 3: Determine remaining window TTL for Retry-After headers
        ttl = await redis_client.ttl(key)
        retry_after = max(ttl, 1)

        # Step 4: Check if current request count exceeds allowed threshold
        if current_count > limit:
            logger.warning("User %s exceeded rate limit: %s/%s requests", user_id, current_count, limit)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {limit} requests per {window_seconds}s allowed. Try again in {retry_after}s.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )
    except HTTPException:
        # Step 5a: Re-raise 429 rate limit exceptions
        raise
    except Exception as e:
        # Step 5b: Log Redis failure and fail open or re-raise
        logger.error("Rate limiter check failed: %s. Allowing request.", e)
        raise

