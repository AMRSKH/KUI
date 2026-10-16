import { PaneNode, SplitDirection } from '../types/terminal';

/**
 * Traverses the pane tree to collect all leaf session IDs
 */
export function collectSessionIds(node: PaneNode): string[] {
  if (node.type === 'leaf') {
    return [node.sessionId];
  }
  return [
    ...collectSessionIds(node.children[0]),
    ...collectSessionIds(node.children[1]),
  ];
}

/**
 * Finds the first leaf session ID in a subtree
 */
export function findFirstSessionId(node: PaneNode): string | null {
  if (node.type === 'leaf') {
    return node.sessionId;
  }
  return findFirstSessionId(node.children[0]);
}

/**
 * Splits a target leaf into two children (target and new session)
 */
export function splitLeaf(
  root: PaneNode,
  targetSessionId: string,
  newSessionId: string,
  direction: SplitDirection
): PaneNode {
  if (root.type === 'leaf') {
    if (root.sessionId === targetSessionId) {
      return {
        type: 'split',
        direction,
        ratio: 0.5,
        children: [
          { type: 'leaf', sessionId: root.sessionId, title: root.title },
          { type: 'leaf', sessionId: newSessionId, title: 'Terminal' },
        ],
      };
    }
    return root;
  }

  return {
    ...root,
    children: [
      splitLeaf(root.children[0], targetSessionId, newSessionId, direction),
      splitLeaf(root.children[1], targetSessionId, newSessionId, direction),
    ],
  };
}

/**
 * Removes a leaf by sessionId. If found, its sibling replaces the parent split node.
 * Returns null if the tree becomes empty.
 */
export function removeLeaf(root: PaneNode, targetSessionId: string): PaneNode | null {
  if (root.type === 'leaf') {
    return root.sessionId === targetSessionId ? null : root;
  }

  const [left, right] = root.children;

  // If left child is the target leaf, replace root with right child
  if (left.type === 'leaf' && left.sessionId === targetSessionId) {
    return right;
  }

  // If right child is the target leaf, replace root with left child
  if (right.type === 'leaf' && right.sessionId === targetSessionId) {
    return left;
  }

  // Otherwise recurse down
  const newLeft = removeLeaf(left, targetSessionId);
  const newRight = removeLeaf(right, targetSessionId);

  if (!newLeft && !newRight) return null;
  if (!newLeft) return newRight;
  if (!newRight) return newLeft;

  return {
    ...root,
    children: [newLeft, newRight],
  };
}

/**
 * Updates ratio of a split node identified by path or reference
 */
export function updateSplitRatio(
  root: PaneNode,
  targetFirstChildSessionId: string,
  newRatio: number
): PaneNode {
  if (root.type === 'leaf') {
    return root;
  }

  const leftSessionIds = collectSessionIds(root.children[0]);
  if (leftSessionIds.includes(targetFirstChildSessionId)) {
    // If the target is directly the first child's first leaf or contained within
    // check if this is the direct split node
    if (root.children[0].type === 'leaf' && root.children[0].sessionId === targetFirstChildSessionId) {
      return {
        ...root,
        ratio: Math.min(Math.max(newRatio, 0.1), 0.9),
      };
    }
  }

  return {
    ...root,
    children: [
      updateSplitRatio(root.children[0], targetFirstChildSessionId, newRatio),
      updateSplitRatio(root.children[1], targetFirstChildSessionId, newRatio),
    ],
  };
}
