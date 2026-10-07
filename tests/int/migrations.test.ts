// Guards what no other test can see. Tests and `next dev` build the database by pushing the collections' schema, but
// production builds it from the committed migrations. This fails when
//  - a collection changed and nobody ran `npm run payload migrate:create <name>`, so production would start on the old
//    schema, or an index such as the unique booking slot went missing from the migration;
//  - a `down` can't run: migrations run without a transaction, so a failed one leaves a half-dropped database.
import type { MigrateUpArgs } from "@payloadcms/db-sqlite";
import { drizzle } from "@payloadcms/db-sqlite/drizzle/libsql";
import { createLocalReq } from "payload";
import { describe, expect, it } from "vitest";
import { migrations } from "@/migrations";
import { getTestPayload } from "../helpers";

type Db = MigrateUpArgs["db"];

const emptyDatabase = (): Db => drizzle<Record<string, unknown>>(":memory:");

async function query(db: Db, sql: string, ...args: string[]) {
  const { columns, rows } = await db.$client.execute({ sql, args });
  return rows.map((row) => Object.fromEntries(columns.map((name, i) => [name, row[i]])));
}

/**
 * What is compared, per table: each column's name, type, NOT NULL, PK and default; each index's name, whether it is
 * unique and its columns in order (plain and unique indexes alike); each foreign key's columns and its ON UPDATE and
 * ON DELETE actions. SQLite's own tables are left out.
 * Not compared: the order of the columns, and details only the CREATE statement shows (CHECK, COLLATE, AUTOINCREMENT,
 * a partial index's WHERE). Payload's SQLite builder doesn't emit those; AUTOINCREMENT only with the adapter's
 * `autoIncrement` option, which is off.
 */
async function describeSchema(db: Db) {
  const tables = await query(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const schema: Record<string, unknown> = {};
  for (const { name } of tables) {
    const table = String(name);
    schema[table] = {
      columns: await query(
        db,
        'SELECT name, type, "notnull", pk, dflt_value FROM pragma_table_info(?) ORDER BY name',
        table,
      ),
      indexes: await query(
        db,
        `SELECT il.name AS "index", il."unique", ii.seqno, ii.name AS "column"
         FROM pragma_index_list(?) il, pragma_index_info(il.name) ii ORDER BY il.name, ii.seqno`,
        table,
      ),
      foreignKeys: await query(
        db,
        'SELECT "from", "table", "to", on_update, on_delete FROM pragma_foreign_key_list(?) ORDER BY "from", "table"',
        table,
      ),
    };
  }
  return schema;
}

/**
 * Runs every migration in one direction (newest first when rolling back) on `db`, the way Payload does. The generated
 * ones only use `db`; payload and req belong to the test database, so a data migration through them would not land here.
 */
async function run(db: Db, direction: "up" | "down") {
  const payload = await getTestPayload();
  const args = { db, payload, req: await createLocalReq({}, payload) };
  for (const migration of direction === "up" ? migrations : [...migrations].reverse()) await migration[direction](args);
}

describe("migrations", () => {
  it("build the schema the collections describe", async () => {
    const db = emptyDatabase();
    await run(db, "up");
    const built = await describeSchema(db);
    // The test database was pushed from the collections when Payload booted.
    const wanted = await describeSchema((await getTestPayload()).db.drizzle);
    // Table by table, so a failure names its table.
    for (const table of new Set([...Object.keys(wanted), ...Object.keys(built)])) {
      const message = [
        `Table "${table}" differs between the collections and the migrations (- only in the collections, + only in the migrations).`,
        "If a collection changed, run `npm run payload migrate:create <name>`",
      ].join(" ");
      expect.soft(built[table], message).toEqual(wanted[table]);
    }
  });

  it("roll back in reverse order and leave nothing behind", async () => {
    const db = emptyDatabase();
    await run(db, "up");
    await run(db, "down");
    expect(await query(db, "SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")).toEqual([]);
  });
});
