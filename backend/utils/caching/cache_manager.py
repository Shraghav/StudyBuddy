import json
import logging
from typing import Any
from uuid import UUID

from backend.utils.caching.redis_client import redis_client

logger = logging.getLogger(__name__)
DEFAULT_CACHE_TTL = 900

class CacheManager:
    """Manages True Write-Through (in-place cache updates) and Read-Through caching."""
    @staticmethod
    def user_documents_key(user_id: UUID) -> str:
        return f"cache:user:{user_id}:documents"

    @staticmethod
    def user_chat_history_key(user_id: UUID) -> str:
        return f"cache:user:{user_id}:chat_history"

    @staticmethod
    def user_quiz_sidebar_key(user_id: UUID) -> str:
        return f"cache:user:{user_id}:quiz_sidebar"


    @staticmethod
    def document_chunks_key(doc_id: UUID) -> str:
        return f"cache:doc:{doc_id}:chunks"

    @staticmethod
    async def get_json(key: str) -> Any:
        """Attempts to read and deserialize a cached JSON value from Redis."""
        try:
            # Step 1: Read raw serialized string from Redis
            raw = await redis_client.get(key)
            # Step 2: Deserialize JSON on hit or return None on cache miss
            if raw:
                logger.info("DB Cache HIT for key %s", key)
                return json.loads(raw)
            logger.info("DB Cache MISS for key %s", key)
            return None
        except Exception as e:
            logger.error("Error reading cache for key %s: %s", key, e)
            raise

    @staticmethod
    async def set_json(key: str, data: Any, ttl: int = DEFAULT_CACHE_TTL) -> bool:
        """Serializes and saves data to Redis with a TTL."""
        try:
            # Step 1: Serialize Python data to JSON string
            serialized = json.dumps(data)
            # Step 2: Store in Redis with expiration TTL
            await redis_client.set(key, serialized, ex=ttl)
            logger.info("DB Cache SET for key %s (TTL: %ss)", key, ttl)
            return True
        except Exception as e:
            logger.error("Error setting cache for key %s: %s", key, e)
            raise

    @staticmethod
    async def invalidate(*keys: str) -> int:
        """Deletes one or more cache keys if explicitly needed."""
        try:
            # Step 1: Evict designated keys from Redis
            deleted_count = await redis_client.delete(*keys)
            logger.info("DB Cache INVALIDATED %s keys: %s", deleted_count, keys)
            return deleted_count
        except Exception as e:
            logger.error("Error invalidating cache keys %s: %s", keys, e)
            raise

    @staticmethod
    async def invalidate_user_documents(user_id: UUID) -> int:
        return await CacheManager.invalidate(CacheManager.user_documents_key(user_id))

    @staticmethod
    async def invalidate_user_chat_history(user_id: UUID) -> int:
        return await CacheManager.invalidate(CacheManager.user_chat_history_key(user_id))

    @staticmethod
    async def invalidate_user_quiz_sidebar(user_id: UUID) -> int:
        return await CacheManager.invalidate(CacheManager.user_quiz_sidebar_key(user_id))

    @staticmethod
    async def set_document_chunks(doc_id: UUID, chunks: list[dict[str, Any]], ttl: int = 86400) -> bool:
        """Write-Through: Caches vectorized document chunks in Redis for instant retrieval."""
        try:
            key = CacheManager.document_chunks_key(doc_id)
            return await CacheManager.set_json(key, chunks, ttl=ttl)
        except Exception as e:
            logger.error("Error caching document chunks for %s: %s", doc_id, e)
            raise

    @staticmethod
    async def get_document_chunks(doc_id: UUID) -> list[dict[str, Any]] | None:
        """Retrieves cached document chunks from Redis."""
        try:
            key = CacheManager.document_chunks_key(doc_id)
            return await CacheManager.get_json(key)
        except Exception as e:
            logger.error("Error reading cached document chunks for %s: %s", doc_id, e)
            raise

    @staticmethod
    async def add_user_document(user_id: UUID, doc_dict: dict[str, Any]) -> None:
        """Write-Through: Inserts new document into the cached list in-place."""
        try:
            # Step 1: Read existing document list from Redis
            key = CacheManager.user_documents_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                # Step 2: Prepend newest document to maintain descending sort
                cached.insert(0, doc_dict)
                # Step 3: Write back updated list to Redis
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Appended document %s to cache %s", doc_dict.get("id"), key)
        except Exception as e:
            logger.error("Error in add_user_document: %s", e)
            raise

    @staticmethod
    async def remove_user_documents(user_id: UUID, doc_ids: list[UUID]) -> None:
        """Write-Through: Filters out deleted documents from the cached list in-place."""
        try:
            # Step 1: Read existing cached document list
            key = CacheManager.user_documents_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                # Step 2: Filter out matching deleted IDs
                del_set = {str(d) for d in doc_ids}
                filtered = [d for d in cached if d.get("id") not in del_set]
                # Step 3: Write back filtered list to Redis
                await CacheManager.set_json(key, filtered)
                logger.info("Write-Through: Removed %s documents from cache %s", len(doc_ids), key)
        except Exception as e:
            logger.error("Error in remove_user_documents: %s", e)
            raise

    @staticmethod
    async def add_user_chat_session(user_id: UUID, session_dict: dict[str, Any]) -> None:
        """Write-Through: Inserts new chat session into the cached history in-place."""
        try:
            # Step 1: Read cached chat session list
            key = CacheManager.user_chat_history_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                # Step 2: Prepend new session to preserve sort order and write back
                cached.insert(0, session_dict)
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Appended chat session %s to cache %s", session_dict.get("id"), key)
        except Exception as e:
            logger.error("Error in add_user_chat_session: %s", e)
            raise

    @staticmethod
    async def add_message_to_chat_session(user_id: UUID, session_id: UUID, msg_dict: dict[str, Any]) -> None:
        """Write-Through: Appends a new message to the session's message list in-place."""
        try:
            # Step 1: Read cached chat history
            key = CacheManager.user_chat_history_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                # Step 2: Locate target session and append message
                sid_str = str(session_id)
                for s in cached:
                    if s.get("id") == sid_str:
                        s.setdefault("messages", []).append(msg_dict)
                        break
                # Step 3: Persist modified history to cache
                await CacheManager.set_json(key, cached)
        except Exception as e:
            logger.error("Error in add_message_to_chat_session: %s", e)
            raise

    @staticmethod
    async def remove_user_chat_sessions(user_id: UUID, session_ids: list[UUID]) -> None:
        """Write-Through: Removes deleted sessions from cached history in-place."""
        try:
            # Step 1: Read cached chat history
            key = CacheManager.user_chat_history_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                # Step 2: Filter out removed session IDs and write back
                del_set = {str(sid) for sid in session_ids}
                filtered = [s for s in cached if s.get("id") not in del_set]
                await CacheManager.set_json(key, filtered)
                logger.info("Write-Through: Removed %s sessions from cache %s", len(session_ids), key)
        except Exception as e:
            logger.error("Error in remove_user_chat_sessions: %s", e)
            raise

    @staticmethod
    async def add_user_quiz_session(user_id: UUID, quiz_dict: dict[str, Any]) -> None:
        """Write-Through: Inserts new quiz session into the sidebar cache in-place."""
        try:
            # Step 1: Read cached quiz sidebar entries
            key = CacheManager.user_quiz_sidebar_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                # Step 2: Prepend new quiz entry and save to Redis
                cached.insert(0, quiz_dict)
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Appended quiz session %s to cache %s", quiz_dict.get("session_id") or quiz_dict.get("id"), key)
        except Exception as e:
            logger.error("Error in add_user_quiz_session: %s", e)
            raise

    @staticmethod
    async def remove_user_quiz_sessions(user_id: UUID, session_ids: list[UUID]) -> None:
        """Write-Through: Removes deleted quizzes from the sidebar cache in-place."""
        try:
            # Step 1: Read cached quiz sidebar
            key = CacheManager.user_quiz_sidebar_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                # Step 2: Filter out removed quiz IDs and write back
                del_set = {str(sid) for sid in session_ids}
                filtered = [
                    q for q in cached
                    if str(q.get("session_id")) not in del_set
                ]
                await CacheManager.set_json(key, filtered)
                logger.info("Write-Through: Removed %s quizzes from cache %s", len(session_ids), key)
        except Exception as e:
            logger.error("Error in remove_user_quiz_sessions: %s", e)
            raise