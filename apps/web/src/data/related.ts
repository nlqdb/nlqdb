// Deterministic related-links fallback for the data-driven page families
// (`/vs`, `/solve`): the next `n` siblings after `item` in a ring over `pool`.
// A ring gives every entry exactly `n` inbound links from its cluster, where
// "top 3 of the cluster" would pile every link onto the same three pages and
// leave the rest at one inbound (their index page) — the shape the 2026-09
// Ahrefs audit flagged on 71 pages.
//
// `cluster` is the topical pool (same persona); when it is too small to fill
// `n`, the remainder comes from the ring over `all`, so a two-member cluster
// still emits `n` links.
export function ringNeighbours<T>(
  cluster: readonly T[],
  all: readonly T[],
  item: T,
  n: number,
): T[] {
  const ring = (pool: readonly T[]) => {
    const i = pool.indexOf(item);
    if (i < 0) return [];
    const count = Math.min(n, pool.length - 1);
    return Array.from({ length: count }, (_, k) => pool[(i + 1 + k) % pool.length] as T);
  };
  return [...new Set([...ring(cluster), ...ring(all)])].slice(0, n);
}
