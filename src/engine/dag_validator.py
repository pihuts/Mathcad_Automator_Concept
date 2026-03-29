"""
DAG Validator - Cycle detection for workflow definitions.

Uses Kahn's algorithm (topological sort) for O(V+E) cycle detection.
"""
from collections import deque
from typing import List, Tuple, Set, Dict

from src.engine.protocol import FileMapping, WorkflowConfig


def detect_cycle(file_mappings: List[FileMapping]) -> Tuple[bool, List[str]]:
    """
    Detect circular dependencies in workflow file mappings.

    Uses Kahn's algorithm for topological sort. If we can't process all nodes,
    there's a cycle.

    Args:
        file_mappings: List of FileMapping objects defining workflow dependencies

    Returns:
        Tuple of (has_cycle, cycle_path):
        - has_cycle: True if a cycle exists, False otherwise
        - cycle_path: List of file names forming the cycle (empty if no cycle)
    """
    if not file_mappings:
        return (False, [])

    # Build adjacency list: source_file -> [target_files]
    graph: Dict[str, List[str]] = {}
    all_files: Set[str] = set()

    for mapping in file_mappings:
        source = mapping.source_file
        target = mapping.target_file
        all_files.add(source)
        all_files.add(target)
        if source not in graph:
            graph[source] = []
        graph[source].append(target)

    # Calculate in-degree for each node
    in_degree: Dict[str, int] = {f: 0 for f in all_files}
    for source, targets in graph.items():
        for target in targets:
            in_degree[target] = in_degree.get(target, 0) + 1

    # Kahn's algorithm: start with nodes that have no incoming edges
    queue = deque([f for f in all_files if in_degree.get(f, 0) == 0])
    visited = 0
    processed: List[str] = []

    while queue:
        node = queue.popleft()
        processed.append(node)
        visited += 1
        for neighbor in graph.get(node, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # If we didn't visit all nodes, there's a cycle
    if visited != len(all_files):
        # Find the cycle path among remaining nodes
        remaining = all_files - set(processed)
        cycle_path = _find_cycle_path(graph, remaining)
        return (True, cycle_path)

    return (False, [])


def _find_cycle_path(graph: Dict[str, List[str]], nodes: Set[str]) -> List[str]:
    """
    Find a cycle path among the given nodes.

    Uses DFS to find any cycle in the remaining unprocessed nodes.

    Args:
        graph: Adjacency list
        nodes: Set of nodes that are part of a cycle

    Returns:
        List of file names forming a cycle
    """
    if not nodes:
        return []

    # Filter graph to only include nodes in the cycle
    subgraph = {n: [t for t in graph.get(n, []) if t in nodes] for n in nodes}

    # DFS to find cycle
    visited: Set[str] = set()
    rec_stack: Set[str] = set()
    path: List[str] = []

    def dfs(node: str) -> List[str] | None:
        visited.add(node)
        rec_stack.add(node)
        path.append(node)

        for neighbor in subgraph.get(node, []):
            if neighbor not in visited:
                result = dfs(neighbor)
                if result:
                    return result
            elif neighbor in rec_stack:
                # Found cycle - extract it from path
                cycle_start = path.index(neighbor)
                return path[cycle_start:] + [neighbor]

        path.pop()
        rec_stack.remove(node)
        return None

    for node in nodes:
        if node not in visited:
            path.clear()
            rec_stack.clear()
            result = dfs(node)
            if result:
                return result

    # Fallback: return all remaining nodes if cycle path couldn't be determined
    return list(nodes)


def validate_workflow_dag(config: WorkflowConfig) -> None:
    """
    Validate workflow DAG structure, raise ValueError if cycle detected.

    Args:
        config: WorkflowConfig to validate

    Raises:
        ValueError: If circular dependency detected, with cycle path in message
    """
    has_cycle, cycle_path = detect_cycle(config.mappings)

    if has_cycle:
        cycle_str = " -> ".join(cycle_path)
        raise ValueError(f"Circular dependency detected: {cycle_str}")
