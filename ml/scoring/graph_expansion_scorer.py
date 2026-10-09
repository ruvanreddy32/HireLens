import logging
import sys
from collections import deque
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import networkx as nx
from ml.resources.graph_config import SKILL_EDGES

logger = logging.getLogger(__name__)


def _build_graph_from_config() -> nx.Graph:
    """Build NetworkX skill graph from configured edges."""
    graph = nx.Graph()
    graph.add_weighted_edges_from(SKILL_EDGES)
    return graph


_SINGLETON_GRAPH: nx.Graph = _build_graph_from_config()


def get_skill_graph() -> nx.Graph:
    """Return the singleton skill graph instance."""
    return _SINGLETON_GRAPH


def _bfs_find_best_partial_score(
    graph: nx.Graph,
    start_skill: str,
    candidate_skills_lower: set[str],
    max_depth: int,
    depth_penalty: float,
) -> tuple[float, Optional[str], Optional[list[str]], Optional[int]]:
    """Find best transferable credit via BFS graph search."""
    if start_skill not in graph:
        return 0.0, None, None, None

    best_score: float = 0.0
    best_match: Optional[str] = None
    best_path: Optional[list[str]] = None
    best_depth: Optional[int] = None

    # BFS queue: (current_node, current_depth, cumulative_weight, path)
    queue: deque[tuple[str, int, float, list[str]]] = deque()
    visited: set[str] = {start_skill}

    for neighbour in graph.neighbors(start_skill):
        edge_weight = graph[start_skill][neighbour].get("weight", 0.5)
        queue.append((neighbour, 1, edge_weight, [start_skill, neighbour]))
        visited.add(neighbour)

    while queue:
        current_node, depth, cumulative_weight, path = queue.popleft()
        partial = cumulative_weight * (depth_penalty ** depth)

        if current_node.lower() in candidate_skills_lower:
            if partial > best_score:
                best_score = partial
                best_match = current_node
                best_path = path
                best_depth = depth

        if depth < max_depth:
            for neighbour in graph.neighbors(current_node):
                if neighbour not in visited:
                    visited.add(neighbour)
                    edge_weight = graph[current_node][neighbour].get("weight", 0.5)
                    queue.append((
                        neighbour,
                        depth + 1,
                        cumulative_weight * edge_weight,
                        path + [neighbour],
                    ))

    return best_score, best_match, best_path, best_depth


def compute_graph_expansion_score(
    missing_required: list[str],
    candidate_skills: list[str],
    graph: Optional[nx.Graph] = None,
    max_depth: int = 2,
    depth_penalty: float = 0.5,
) -> dict:
    """Compute partial credit score for missing skills using graph traversal."""
    if graph is None:
        graph = _SINGLETON_GRAPH

    if not missing_required:
        return {
            "graph_expansion_score": 1.0,
            "expansions": [],
            "skills_recovered": [],
            "skills_unrecovered": [],
        }

    candidate_skills_lower: set[str] = {s.lower() for s in (candidate_skills or [])}

    expansions: list[dict] = []
    skills_recovered: list[str] = []
    skills_unrecovered: list[str] = []
    partial_scores: list[float] = []

    for missing_skill in missing_required:
        score, matched_via, via_path, hop_depth = _bfs_find_best_partial_score(
            graph=graph,
            start_skill=missing_skill,
            candidate_skills_lower=candidate_skills_lower,
            max_depth=max_depth,
            depth_penalty=depth_penalty,
        )

        expansions.append({
            "missing_skill": missing_skill,
            "matched_via": matched_via,
            "via_path": via_path,
            "partial_score": round(score, 4),
            "hop_depth": hop_depth,
        })
        partial_scores.append(score)

        if score > 0.0:
            skills_recovered.append(missing_skill)
        else:
            skills_unrecovered.append(missing_skill)

    graph_expansion_score = (
        sum(partial_scores) / len(partial_scores) if partial_scores else 0.0
    )

    return {
        "graph_expansion_score": round(graph_expansion_score, 4),
        "expansions": expansions,
        "skills_recovered": skills_recovered,
        "skills_unrecovered": skills_unrecovered,
    }
