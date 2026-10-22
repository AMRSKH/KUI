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
 * Checks if a session ID exists as a leaf in the tree
 */
export function hasLeaf(root: PaneNode, sessionId: string): boolean {
  if (root.type === 'leaf') {
    return root.sessionId === sessionId;
  }
  return hasLeaf(root.children[0], sessionId) || hasLeaf(root.children[1], sessionId);
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
  const targetId = (targetSessionId && hasLeaf(root, targetSessionId))
    ? targetSessionId
    : (findFirstSessionId(root) || targetSessionId);

  function doSplit(node: PaneNode): PaneNode {
    if (node.type === 'leaf') {
      if (node.sessionId === targetId) {
        return {
          type: 'split',
          direction,
          ratio: 0.5,
          children: [
            { type: 'leaf', sessionId: node.sessionId, title: node.title || 'Terminal' },
            { type: 'leaf', sessionId: newSessionId, title: 'Terminal' },
          ],
        };
      }
      return node;
    }

    return {
      ...node,
      children: [
        doSplit(node.children[0]),
        doSplit(node.children[1]),
      ],
    };
  }

  return doSplit(root);
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
 * Updates the ratio of the split node whose *left* subtree starts with
 * targetFirstChildSessionId.
 *
 * The identifier is the first leaf of the left child, so nested splits
 * (a split whose left child is itself a split) can be resized too.
 */
export function updateSplitRatio(
  root: PaneNode,
  targetFirstChildSessionId: string,
  newRatio: number
): PaneNode {
  if (root.type === 'leaf') {
    return root;
  }

  // The divider that is being dragged is the one whose left side contains the
  // given leaf. Match on the first leaf so nested splits resolve correctly.
  if (findFirstSessionId(root.children[0]) === targetFirstChildSessionId) {
    return {
      ...root,
      ratio: Math.min(Math.max(newRatio, 0.1), 0.9),
    };
  }

  return {
    ...root,
    children: [
      updateSplitRatio(root.children[0], targetFirstChildSessionId, newRatio),
      updateSplitRatio(root.children[1], targetFirstChildSessionId, newRatio),
    ],
  };
}
