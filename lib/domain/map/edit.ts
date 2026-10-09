import type { MapEdge, MapNode, NodeKind, Relation } from '../types.ts';
import { ok, err } from '../result.ts';
import type { Result } from '../result.ts';

export const MAX_NODES = 60;
export const MAX_EDGES = 120;
export const EDITABLE_KINDS: readonly NodeKind[] = ['situation', 'thought', 'emotion', 'body', 'behavior', 'context', 'strength'];
export const RELATIONS: readonly Relation[] = ['appears_with', 'tends_to_follow', 'may_maintain', 'may_reduce', 'blocks'];

export function nodeId(label: string): string {
  return 'n_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

export function validateNewNode(nodes: MapNode[], label: string, kind: string): Result<MapNode> {
  const l = label.trim();
  if (l.length < 1 || l.length > 60) return err('Name it in a few words (up to 60 characters).');
  if (!(EDITABLE_KINDS as readonly string[]).includes(kind)) return err('Unknown kind.');
  if (nodes.length >= MAX_NODES) return err('The Map is full. Remove something first.');
  const id = nodeId(l);
  if (nodes.some((n) => n.id === id || n.label.toLowerCase() === l.toLowerCase())) return err('That is already on your Map.');
  return ok({ id, label: l, kind: kind as NodeKind });
}

export function validateNewEdge(nodes: MapNode[], edges: MapEdge[], from: string, to: string, relation: string): Result<{ from: string; to: string; relation: Relation }> {
  if (from === to) return err('Choose two different things.');
  if (!nodes.some((n) => n.id === from) || !nodes.some((n) => n.id === to)) return err('Choose things that are on your Map.');
  if (!(RELATIONS as readonly string[]).includes(relation)) return err('Unknown relation.');
  if (edges.length >= MAX_EDGES) return err('The Map has too many links.');
  if (edges.some((e) => e.from === from && e.to === to && e.status !== 'dismissed')) return err('That link is already on your Map.');
  return ok({ from, to, relation: relation as Relation });
}
