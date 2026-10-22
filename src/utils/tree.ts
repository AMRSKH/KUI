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
