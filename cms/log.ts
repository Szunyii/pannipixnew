/** What the server log may say about a failure: its kind, and the codes of the database driver or the mail server. */
export type LoggableError = {
  name: string;
  code?: string | number;
  /** The mail server's reply code, e.g. 550. */
  responseCode?: number;
  /** The mail command that failed, e.g. "RCPT TO". */
  command?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isCode = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

/**
 * Reduces a failure to what is safe to log. An error is never logged whole: Drizzle appends the query's parameters to
 * its message (a visitor's name, email, phone and note), and a mail error carries the addresses in its message,
 * `response` and `rejected`. Only identifiers are kept: the error's name, the code of the driver error underneath
 * (Drizzle wraps it as `cause`), and the mail server's reply code and command. Message and stack stay out.
 */
export function loggableError(err: unknown): LoggableError {
  if (!isRecord(err)) return { name: "unknown" };
  const cause = isRecord(err.cause) ? err.cause : {};
  // Plain values only: an object a library attached to the error could hold what must stay out of the log.
  return {
    name: typeof err.name === "string" ? err.name : "unknown",
    code: [cause.code, err.code].find(isCode),
    responseCode: typeof err.responseCode === "number" ? err.responseCode : undefined,
    command: typeof err.command === "string" ? err.command : undefined,
  };
}
