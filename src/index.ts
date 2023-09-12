import { connect, Connection, Tx, Config, FullResult } from '@tidbcloud/serverless';

import {
  CompiledQuery,
  DatabaseConnection,
  DatabaseIntrospector,
  Dialect,
  Driver,
  Kysely,
  MysqlAdapter,
  MysqlQueryCompiler,
  MysqlIntrospector,
  QueryCompiler,
  QueryResult,
} from 'kysely';

/**
 * Config for the TiDB Serverless dialect.
 *
 * @see https://github.com/tidbcloud/serverless-js for more information.
 */
export interface TiDBServerlessDialectConfig extends Config {}

/**
 * TiDB Serverless dialect that uses the TiDB Serverless Driver
 * The constructor takes an instance of {@link Config} from `@tidbcloud/serverless`.
 *
 * ```typescript
 * new TiDBServerlessDialect({
 *   host: '<host>',
 *   username: '<username>',
 *   password: '<password>',
 * })
 *
 * // or with a connection URL
 *
 * new TiDBServerlessDialect({
 *   url: process.env.DATABASE_URL ?? 'mysql://<username>:<password>@<host>/<database>'
 * })
 * ```
 */
export class TiDBServerlessDialect implements Dialect {
  readonly #config: TiDBServerlessDialectConfig;

  constructor(config: TiDBServerlessDialectConfig) {
    this.#config = config;
  }

  createAdapter() {
    return new MysqlAdapter();
  }

  createDriver(): Driver {
    return new TiDBServerlessDriver(this.#config);
  }

  createQueryCompiler(): QueryCompiler {
    return new MysqlQueryCompiler();
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new MysqlIntrospector(db);
  }
}

class TiDBServerlessDriver implements Driver {
  readonly #config: TiDBServerlessDialectConfig;

  constructor(config: TiDBServerlessDialectConfig) {
    this.#config = config;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return new TiDBServerlessConnection(this.#config);
  }

  async beginTransaction(conn: TiDBServerlessConnection): Promise<void> {
    return await conn.beginTransaction();
  }

  async commitTransaction(conn: TiDBServerlessConnection): Promise<void> {
    return await conn.commitTransaction();
  }

  async rollbackTransaction(conn: TiDBServerlessConnection): Promise<void> {
    return await conn.rollbackTransaction();
  }

  async releaseConnection(_conn: TiDBServerlessConnection): Promise<void> {}

  async destroy(): Promise<void> {}
}

// TiDBServerlessConnection is a wrapper around the TiDB Serverless Connection, it also handles transactions.
class TiDBServerlessConnection implements DatabaseConnection {
  #config: TiDBServerlessDialectConfig;
  #conn: Connection;
  #txClient?: TiDBServerlessTransaction;

  constructor(config: TiDBServerlessDialectConfig) {
    this.#config = config;
    this.#conn = connect(config);
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    let results;
    if (this.#txClient) {
      results = await this.#txClient.execute(compiledQuery);
    } else {
      results = await this.#conn.execute(compiledQuery.sql, [...compiledQuery.parameters], { fullResult: true });
    }

    if (!results) {
      throw new Error('empty result');
    }

    // Use FullResult in kysely
    results = results as FullResult;
    const numAffectedRows = results.rowsAffected ? BigInt(results.rowsAffected) : undefined;
    return {
      insertId:
        results.lastInsertId !== null && results.lastInsertId.toString() !== '0' ? BigInt(results.lastInsertId) : undefined,
      rows: results.rows as O[],
      numAffectedRows,
      // deprecated in kysely > 0.22, keep for backward compatibility.
      numUpdatedOrDeletedRows: numAffectedRows,
    };
  }

  async beginTransaction() {
    const tx = await this.#conn.begin();
    this.#txClient = new TiDBServerlessTransaction(tx);
  }

  async commitTransaction() {
    if (!this.#txClient) throw new Error('No transaction to commit');
    await this.#txClient.commit();
    this.#txClient = undefined;
  }

  async rollbackTransaction() {
    if (!this.#txClient) throw new Error('No transaction to rollback');
    await this.#txClient.rollback();
    this.#txClient = undefined;
  }

  async *streamQuery<O>(_compiledQuery: CompiledQuery, _chunkSize: number): AsyncIterableIterator<QueryResult<O>> {
    throw new Error('TiDB Serverless Driver does not support streaming');
  }
}

// TiDBServerlessTransaction provides basic transaction support for TiDB Serverless.
class TiDBServerlessTransaction {
  readonly #tx: Tx;

  constructor(tx: Tx) {
    this.#tx = tx;
  }

  async execute(compiledQuery: CompiledQuery) {
    return await this.#tx.execute(compiledQuery.sql, [...compiledQuery.parameters], { fullResult: true });
  }

  async commit() {
    await this.#tx.commit();
  }

  async rollback() {
    await this.#tx.rollback();
  }
}
