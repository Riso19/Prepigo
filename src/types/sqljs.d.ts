declare module 'sql.js' {
  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export interface SqlJsDatabaseResult {
    columns: string[];
    values: unknown[][];
  }

  export interface SqlJsDatabase {
    exec: (sql: string) => SqlJsDatabaseResult[];
    close: () => void;
  }

  export interface SqlJs {
    Database: new (data?: Uint8Array) => SqlJsDatabase;
  }

  const initSqlJs: (config?: SqlJsConfig) => Promise<SqlJs>;
  export default initSqlJs;
}