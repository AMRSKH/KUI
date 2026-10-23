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
 */
export function updateSplitRatio(
  root: PaneNode,
  targetFirstChildSessionId: string,
  newRatio: number
): PaneNode {
  if (root.type === 'leaf') {
    return root;
  }

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

export interface PaneRect {
  left: number; // percentage 0-100
  top: number;  // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

export interface LeafPaneLayout {
  sessionId: string;
  title?: string;
  rect: PaneRect;
}

export interface SplitDividerLayout {
  id: string; // first leaf ID of left child
  direction: SplitDirection;
  ratio: number;
  containerRect: PaneRect; // The bounding box of this split in %
  position: number;        // left% (for vertical) or top% (for horizontal)
  start: number;           // top% (for vertical) or left% (for horizontal)
  length: number;          // height% (for vertical) or width% (for horizontal)
}

export interface ComputedLayout {
  leaves: LeafPaneLayout[];
  dividers: SplitDividerLayout[];
}

/**
 * Computes deterministic absolute percentage rectangles for all leaves and divider lines.
 * This guarantees that leaf components never unmount when the tree is split or resized.
 */
export function computeLayout(
  node: PaneNode,
  rect: PaneRect = { left: 0, top: 0, width: 100, height: 100 }
): ComputedLayout {
  const leaves: LeafPaneLayout[] = [];
  const dividers: SplitDividerLayout[] = [];

  function traverse(currNode: PaneNode, currRect: PaneRect) {
    if (currNode.type === 'leaf') {
      leaves.push({
        sessionId: currNode.sessionId,
        title: currNode.title,
        rect: currRect,
      });
      return;
    }

    const { direction, ratio, children } = currNode;
    const firstLeafId = findFirstSessionId(children[0]) || '';

    if (direction === 'vertical') {
      const leftWidth = currRect.width * ratio;
      const rightWidth = currRect.width * (1 - ratio);

      traverse(children[0], {
        left: currRect.left,
        top: currRect.top,
        width: leftWidth,
        height: currRect.height,
      });

      dividers.push({
        id: firstLeafId,
        direction: 'vertical',
        ratio,
        containerRect: currRect,
        position: currRect.left + leftWidth,
        start: currRect.top,
        length: currRect.height,
      });

      traverse(children[1], {
        left: currRect.left + leftWidth,
        top: currRect.top,
        width: rightWidth,
        height: currRect.height,
      });
    } else {
      const topHeight = currRect.height * ratio;
      const bottomHeight = currRect.height * (1 - ratio);

      traverse(children[0], {
        left: currRect.left,
        top: currRect.top,
        width: currRect.width,
        height: topHeight,
      });

      dividers.push({
        id: firstLeafId,
        direction: 'horizontal',
        ratio,
        containerRect: currRect,
        position: currRect.top + topHeight,
        start: currRect.left,
        length: currRect.width,
      });

      traverse(children[1], {
        left: currRect.left,
        top: currRect.top + topHeight,
        width: currRect.width,
        height: bottomHeight,
      });
    }
  }

  traverse(node, rect);
  return { leaves, dividers };
}
