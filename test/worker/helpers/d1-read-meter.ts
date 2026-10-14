/**
 * Wraps a D1Database and sums `meta.rows_read` of every statement executed through
 * `all`, `run`, `first` and `batch`. Only what the code under test uses is wrapped.
 */
export interface ReadMeter {
  db: D1Database;
  /** rows_read accumulated since the last reset. */
  readonly rowsRead: number;
  reset(): void;
}

export function meterD1(real: D1Database): ReadMeter {
  let total = 0;
  const add = (meta: { rows_read?: number } | undefined) => {
    total += meta?.rows_read ?? 0;
  };
  const wrapStatement = (st: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(st, {
      get(target, prop) {
        if (prop === "bind") {
          return (...args: unknown[]) => wrapStatement(target.bind(...args));
        }
        if (prop === "all" || prop === "run") {
          return async () => {
            const res = await (target[prop] as () => Promise<D1Result>)();
            add(res.meta);
            return res;
          };
        }
        if (prop === "first") {
          return async (col?: string) => {
            const res = await target.all();
            add(res.meta);
            const row = res.results[0] as Record<string, unknown> | undefined;
            return col === undefined ? (row ?? null) : (row?.[col] ?? null);
          };
        }
        const v = Reflect.get(target, prop, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
  const db = new Proxy(real, {
    get(target, prop) {
      if (prop === "prepare") return (sql: string) => wrapStatement(target.prepare(sql));
      if (prop === "batch") {
        return async (stmts: D1PreparedStatement[]) => {
          const res = await target.batch(stmts);
          for (const r of res) add(r.meta);
          return res;
        };
      }
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
  return {
    db,
    get rowsRead() {
      return total;
    },
    reset() {
      total = 0;
    },
  };
}
