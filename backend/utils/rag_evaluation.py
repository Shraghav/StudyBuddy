import logging
from collections.abc import Sequence

logger = logging.getLogger(__name__)


def precision_at_k(retrieved: Sequence[str], relevant: set[str], k: int = 5) -> float:
    """Calculates Precision@K: Proportion of top-K retrieved items that are relevant."""
    if k <= 0:
        return 0.0
    top_k = retrieved[:k]
    if not top_k:
        return 0.0
    hits = sum(1 for item in top_k if item in relevant)
    return round(hits / k, 4)


def recall_at_k(retrieved: Sequence[str], relevant: set[str], k: int = 5) -> float:
    """Calculates Recall@K: Proportion of all relevant items found in top-K retrieved items."""
    if not relevant:
        return 0.0
    top_k = retrieved[:k]
    hits = sum(1 for item in top_k if item in relevant)
    return round(hits / len(relevant), 4)


def mean_reciprocal_rank(retrieved: Sequence[str], relevant: set[str]) -> float:
    """Calculates Mean Reciprocal Rank (MRR):

    Reciprocal rank of the first relevant document found in the retrieved list.
    """
    if not relevant:
        return 0.0
    for rank, item in enumerate(retrieved, start=1):
        if item in relevant:
            return round(1.0 / rank, 4)
    return 0.0


def evaluate_retrieval(
    retrieved_chunk_ids: Sequence[str],
    relevant_chunk_ids: set[str],
    k: int = 5,
) -> dict[str, float]:
    """Evaluates information retrieval performance using Precision@K, Recall@K, and MRR.

    Args:
        retrieved_chunk_ids: Ordered list of chunk identifiers returned by vector search.
        relevant_chunk_ids: Set of ground-truth relevant chunk identifiers.
        k: Cutoff rank for evaluation (default 5).

    Returns:
        dict: Metric names mapped to their computed scores.
    """
    p_at_k = precision_at_k(retrieved_chunk_ids, relevant_chunk_ids, k=k)
    r_at_k = recall_at_k(retrieved_chunk_ids, relevant_chunk_ids, k=k)
    mrr_score = mean_reciprocal_rank(retrieved_chunk_ids, relevant_chunk_ids)

    return {
        f"precision_at_{k}": p_at_k,
        f"recall_at_{k}": r_at_k,
        "mrr": mrr_score,
    }

