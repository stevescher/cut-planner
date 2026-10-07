import { GrainGroup, Panel, PanelGrain, Placement } from './types';

/** One part inside a group block, in the block's unrotated frame (X = part length). */
export interface GroupMember {
  panel: Panel;
  /** Index of the panel in the project's panel list (drives its color). */
  panelIndex: number;
  /** 1-based cut order within the group. */
  seq: number;
  /** Offset of the part inside the block: along the block length, then across it. */
  offsetL: number;
  offsetW: number;
}

/**
 * A grain-matched group laid out as one rectangle: its parts side by side
 * (stack) or end to end (row) with a kerf between neighbours, placed by the
 * solver like a single panel and split back into parts afterwards.
 */
export interface GroupBlock {
  group: GrainGroup;
  /** Block size in its unrotated frame. */
  length: number;
  width: number;
  /** Shared grain setting of the members, which the block as a whole obeys. */
  grain: PanelGrain;
  members: GroupMember[];
}

/** Prefix on the panelId of a solver-internal placement that stands for a whole group. */
export const GROUP_PANEL_PREFIX = 'group:';

/** Groups that actually constrain the plan: defined, with at least one valid member. */
export function buildGroupBlocks(
  panels: Panel[],
  groups: GrainGroup[] | undefined,
  kerf: number,
): GroupBlock[] {
  const blocks: GroupBlock[] = [];
  for (const group of groups ?? []) {
    const members: GroupMember[] = [];
    let along = 0; // running offset in the arrangement direction
    let across = 0; // largest extent in the other direction
    panels.forEach((panel, panelIndex) => {
      if (panel.grainGroup !== group.id || !(panel.length > 0 && panel.width > 0)) return;
      for (let q = 0; q < panel.quantity; q++) {
        if (members.length > 0) along += kerf;
        const stack = group.arrangement === 'stack';
        members.push({
          panel,
          panelIndex,
          seq: members.length + 1,
          offsetL: stack ? 0 : along,
          offsetW: stack ? along : 0,
        });
        along += stack ? panel.width : panel.length;
        across = Math.max(across, stack ? panel.length : panel.width);
      }
    });
    if (members.length === 0) continue;
    const stack = group.arrangement === 'stack';
    blocks.push({
      group,
      length: stack ? across : along,
      width: stack ? along : across,
      // The store keeps members' grain in sync; the first member speaks for all.
      grain: members[0].panel.grain,
      members,
    });
  }
  return blocks;
}

/** Ids of panels that belong to one of the given blocks. */
export function groupedPanelIds(blocks: GroupBlock[]): Set<string> {
  const ids = new Set<string>();
  for (const b of blocks) for (const m of b.members) ids.add(m.panel.id);
  return ids;
}

/**
 * Split a placed block into its member placements. A rotated block turns its
 * length onto the Y axis, so each member's offsets swap axes and the member is
 * recorded as rotated too.
 */
export function expandBlock(
  block: GroupBlock,
  at: { x: number; y: number; rotated: boolean },
  colorFor: (panelIndex: number) => string,
): Placement[] {
  return block.members.map((m) => {
    const L = m.panel.length;
    const W = m.panel.width;
    return {
      panelId: m.panel.id,
      label: m.panel.label || `Panel ${m.panelIndex + 1}`,
      x: at.x + (at.rotated ? m.offsetW : m.offsetL),
      y: at.y + (at.rotated ? m.offsetL : m.offsetW),
      width: at.rotated ? W : L,
      height: at.rotated ? L : W,
      rotated: at.rotated,
      pinned: false,
      color: colorFor(m.panelIndex),
      group: { id: block.group.id, seq: m.seq },
    };
  });
}

/** Bounding box of a set of placements. */
export function boundsOf(placements: Placement[]): { x: number; y: number; width: number; height: number } {
  const x0 = Math.min(...placements.map((p) => p.x));
  const y0 = Math.min(...placements.map((p) => p.y));
  const x1 = Math.max(...placements.map((p) => p.x + p.width));
  const y1 = Math.max(...placements.map((p) => p.y + p.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
