// packages/ai-ui/src/lib/sql.ts
const READ_START = /^(?:select|with|explain|show|describe|desc|values|table)\b/i;
const WRITE =
  /\b(?:insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|attach|detach|copy|call|exec|execute|vacuum|reindex|lock|into|setval|nextval)\b|\bfor\s+(?:share|key\s+share|no\s+key)\b/i;

/**
 * Empties comments, string literals, quoted identifiers and dollar-quoted
 * bodies in one pass, so keyword checks only see SQL. Backslashes are not
 * escapes, which matches standard SQL and errs toward flagging writes.
 */
export function stripSqlLiterals(sql: string): string {
  let out = "";
  let index = 0;
  while (index < sql.length) {
    const char = sql[index]!;
    const next = sql[index + 1];
    if (char === "-" && next === "-") {
      const end = sql.indexOf("\n", index);
      index = end === -1 ? sql.length : end;
      out += " ";
    } else if (char === "/" && next === "*") {
      const end = sql.indexOf("*/", index + 2);
      index = end === -1 ? sql.length : end + 2;
      out += " ";
    } else if (char === "'" || char === '"' || char === "`") {
      let cursor = index + 1;
      while (cursor < sql.length) {
        if (sql[cursor] === char) {
          if (sql[cursor + 1] === char) {
            cursor += 2;
            continue;
          }
          break;
        }
        cursor += 1;
      }
      index = cursor + 1;
      out += char + char;
    } else if (char === "$" && /^\$(?:[A-Za-z_]\w*)?\$/.test(sql.slice(index))) {
      const tag = /^\$(?:[A-Za-z_]\w*)?\$/.exec(sql.slice(index))![0];
      const end = sql.indexOf(tag, index + tag.length);
      index = end === -1 ? sql.length : end + tag.length;
      out += " ";
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
}

/** Splits on top-level semicolons, ignoring those inside strings and comments. */
export function splitSqlStatements(sql: string): string[] {
  return stripSqlLiterals(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/**
 * True only when every statement starts with a read keyword and contains no
 * write keyword, so a CTE ending in DELETE, SELECT INTO and SELECT FOR UPDATE
 * are rejected. A UI guard for asking before writes; the server must still run
 * reads in a read-only transaction.
 */
export function isReadOnlySql(sql: string): boolean {
  const statements = splitSqlStatements(sql);
  return statements.length > 0 && statements.every((statement) => READ_START.test(statement) && !WRITE.test(statement));
}
