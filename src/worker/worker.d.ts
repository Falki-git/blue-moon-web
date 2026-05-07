// Minimal ambient types for the bits of the Cloudflare Workers runtime we use.
// Astro doesn't typecheck files under src/worker/ during `astro build`, but this
// keeps editors happy and makes the contract explicit.

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: unknown }>;
  all<T = unknown>(): Promise<{ results?: T[]; success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}
