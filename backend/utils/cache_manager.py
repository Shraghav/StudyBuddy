import json
import logging
from typing import Any
from uuid import UUID

from utils.redis_client import redis_client

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
    def staging_document_key(doc_id: UUID) -> str:
        return f"staging:doc:{doc_id}"

    @staticmethod
    def document_chunks_key(doc_id: UUID) -> str:
        return f"cache:doc:{doc_id}:chunks"

    @staticmethod
    async def get_json(key: str) -> Any:
        """Attempts to read and deserialize a cached JSON value from Redis."""
        try:
            raw = await redis_client.get(key)
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
            serialized = json.dumps(data)
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
    async def stage_document_text(doc_id: UUID, text: str, ttl: int = 3600) -> bool:
        """Stores raw extracted document text in Redis staging area before chunking."""
        try:
            key = CacheManager.staging_document_key(doc_id)
            await redis_client.set(key, text, ex=ttl)
            logger.info("Staged raw document %s in Redis (TTL: %ss, length: %s)", doc_id, ttl, len(text))
            return True
        except Exception as e:
            logger.error("Error staging raw document %s: %s", doc_id, e)
            raise

    @staticmethod
    async def get_staged_document_text(doc_id: UUID) -> str | None:
        """Retrieves raw extracted document text from Redis staging area."""
        try:
            key = CacheManager.staging_document_key(doc_id)
            raw = await redis_client.get(key)
            if raw:
                logger.info("Retrieved staged document %s from Redis", doc_id)
                return raw
            return None
        except Exception as e:
            logger.error("Error reading staged document %s: %s", doc_id, e)
            raise

    @staticmethod
    async def clear_staged_document_text(doc_id: UUID) -> int | None:
        """Deletes staged raw document text from Redis once chunking and embedding completes."""
        try:
            key = CacheManager.staging_document_key(doc_id)
            deleted = await redis_client.delete(key)
            logger.info("Cleared staged document %s from Redis (deleted: %s)", doc_id, deleted)
            return deleted
        except Exception as e:
            logger.error("Error clearing staged document %s: %s", doc_id, e)
            raise

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
            key = CacheManager.user_documents_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                # Prepend newest document to maintain descending sort
                cached.insert(0, doc_dict)
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Appended document %s to cache %s", doc_dict.get("id"), key)
        except Exception as e:
            logger.error("Error in add_user_document: %s", e)
            raise

    @staticmethod
    async def update_user_document_name(user_id: UUID, doc_id: UUID, new_name: str) -> None:
        """Write-Through: Modifies the document name in the cached list in-place."""
        try:
            key = CacheManager.user_documents_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                doc_id_str = str(doc_id)
                updated = False
                for doc in cached:
                    if doc.get("id") == doc_id_str:
                        doc["name"] = new_name
                        updated = True
                        break
                if updated:
                    await CacheManager.set_json(key, cached)
                    logger.info("Write-Through: Renamed document %s in cache %s", doc_id, key)
        except Exception as e:
            logger.error("Error in update_user_document_name: %s", e)
            raise

    @staticmethod
    async def remove_user_documents(user_id: UUID, doc_ids: list[UUID]) -> None:
        """Write-Through: Filters out deleted documents from the cached list in-place."""
        try:
            key = CacheManager.user_documents_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                del_set = {str(d) for d in doc_ids}
                filtered = [d for d in cached if d.get("id") not in del_set]
                await CacheManager.set_json(key, filtered)
                logger.info("Write-Through: Removed %s documents from cache %s", len(doc_ids), key)
        except Exception as e:
            logger.error("Error in remove_user_documents: %s", e)
            raise

    @staticmethod
    async def add_user_chat_session(user_id: UUID, session_dict: dict[str, Any]) -> None:
        """Write-Through: Inserts new chat session into the cached history in-place."""
        try:
            key = CacheManager.user_chat_history_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                cached.insert(0, session_dict)
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Appended chat session %s to cache %s", session_dict.get("id"), key)
        except Exception as e:
            logger.error("Error in add_user_chat_session: %s", e)
            raise

    @staticmethod
    async def update_user_chat_session_title(user_id: UUID, session_id: UUID, new_title: str) -> None:
        """Write-Through: Updates chat session title in-place."""
        try:
            key = CacheManager.user_chat_history_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                sid_str = str(session_id)
                for s in cached:
                    if s.get("id") == sid_str:
                        s["title"] = new_title
                        break
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Renamed chat session %s in cache %s", session_id, key)
        except Exception as e:
            logger.error("Error in update_user_chat_session_title: %s", e)
            raise

    @staticmethod
    async def update_user_chat_session_document(user_id: UUID, session_id: UUID, attached_doc_name: str) -> None:
        """Write-Through: Updates attached document name on chat session in-place."""
        try:
            key = CacheManager.user_chat_history_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                sid_str = str(session_id)
                for s in cached:
                    if s.get("id") == sid_str:
                        s["attachedDocName"] = attached_doc_name
                        break
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Linked document to chat session %s in cache %s", session_id, key)
        except Exception as e:
            logger.error("Error in update_user_chat_session_document: %s", e)
            raise

    @staticmethod
    async def add_message_to_chat_session(user_id: UUID, session_id: UUID, msg_dict: dict[str, Any]) -> None:
        """Write-Through: Appends a new message to the session's message list in-place."""
        try:
            key = CacheManager.user_chat_history_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                sid_str = str(session_id)
                for s in cached:
                    if s.get("id") == sid_str:
                        s.setdefault("messages", []).append(msg_dict)
                        break
                await CacheManager.set_json(key, cached)
        except Exception as e:
            logger.error("Error in add_message_to_chat_session: %s", e)
            raise

    @staticmethod
    async def remove_user_chat_sessions(user_id: UUID, session_ids: list[UUID]) -> None:
        """Write-Through: Removes deleted sessions from cached history in-place."""
        try:
            key = CacheManager.user_chat_history_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
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
            key = CacheManager.user_quiz_sidebar_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                cached.insert(0, quiz_dict)
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Appended quiz session %s to cache %s", quiz_dict.get("id"), key)
        except Exception as e:
            logger.error("Error in add_user_quiz_session: %s", e)
            raise

    @staticmethod
    async def update_user_quiz_status(user_id: UUID, session_id: UUID, new_status: str) -> None:
        """Write-Through: Updates status of a quiz in the sidebar cache in-place."""
        try:
            key = CacheManager.user_quiz_sidebar_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                sid_str = str(session_id)
                for q in cached:
                    if q.get("id") == sid_str:
                        q["status"] = new_status
                        break
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Updated quiz %s status to %s in cache %s", session_id, new_status, key)
        except Exception as e:
            logger.error("Error in update_user_quiz_status: %s", e)
            raise

    @staticmethod
    async def update_user_quiz_title(user_id: UUID, session_id: UUID, new_title: str) -> None:
        """Write-Through: Updates quiz title in the sidebar cache in-place."""
        try:
            key = CacheManager.user_quiz_sidebar_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                sid_str = str(session_id)
                for q in cached:
                    if q.get("id") == sid_str:
                        q["title"] = new_title
                        break
                await CacheManager.set_json(key, cached)
                logger.info("Write-Through: Renamed quiz %s in cache %s", session_id, key)
        except Exception as e:
            logger.error("Error in update_user_quiz_title: %s", e)
            raise

    @staticmethod
    async def remove_user_quiz_sessions(user_id: UUID, session_ids: list[UUID]) -> None:
        """Write-Through: Removes deleted quizzes from the sidebar cache in-place."""
        try:
            key = CacheManager.user_quiz_sidebar_key(user_id)
            cached = await CacheManager.get_json(key)
            if cached is not None:
                del_set = {str(sid) for sid in session_ids}
                filtered = [q for q in cached if q.get("id") not in del_set]
                await CacheManager.set_json(key, filtered)
                logger.info("Write-Through: Removed %s quizzes from cache %s", len(session_ids), key)
        except Exception as e:
            logger.error("Error in remove_user_quiz_sessions: %s", e)
            raise
