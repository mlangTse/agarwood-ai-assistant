import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as {
  agarwoodPgPool?: Pool;
  agarwoodPgUnavailable?: boolean;
};

export type Database = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
};

export async function getDatabase(): Promise<Database | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || globalForPg.agarwoodPgUnavailable) return null;

  const pool =
    globalForPg.agarwoodPgPool ??
    new Pool({
      connectionString,
      max: Number.parseInt(process.env.POSTGRES_POOL_MAX ?? "10", 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });

  globalForPg.agarwoodPgPool = pool;

  try {
    await pool.query("select 1");
  } catch (error) {
    globalForPg.agarwoodPgUnavailable = true;
    console.warn("PostgreSQL connection failed, falling back to local data:", error);
    return null;
  }

  return {
    query: (text, values) => pool.query(text, values),
    transaction: async (callback) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await callback(client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

export function vectorLiteral(values: number[]) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
