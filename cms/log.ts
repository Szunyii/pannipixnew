/** What the server log may say about a failure instead of the error itself. */
export type LoggableError = {
  name: string;
  code?: string | number;
  /** The mail server's reply code, e.g. 550. */
  responseCode?: number;
  /** The mail command that failed, e.g. "RCPT TO". */
  command?: string;
  /** The fields a validation error is about, e.g. ["email"]. Field names are ours, never what was entered. */
  paths?: string[];
  /** Where a bug in our own code happened. Only for the kinds of error whose message carries no input. */
  stack?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isCode = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

/**
 * The errors that mean a bug in our own code. Their messages describe the code ("x.map is not a function", "Invalid
 * time value"), not the input. A SyntaxError doesn't belong here: JSON.parse quotes the text it choked on.
 */
const BUGS = new Set(["TypeError", "RangeError", "ReferenceError"]);

/** The paths of the fields a Payload ValidationError refused; undefined when it names none. */
function fieldPaths(err: Record<string, unknown>): string[] | undefined {
  const errors = isRecord(err.data) && Array.isArray(err.data.errors) ? err.data.errors : [];
  const paths = errors.flatMap((e) => (isRecord(e) && typeof e.path === "string" ? [e.path] : []));
  return paths.length > 0 ? paths : undefined;
}

/**
 * Reduces a failure to what is safe to log. An error is never logged whole: Drizzle appends the query's parameters to
 * its message (a visitor's name, email, phone and note), and a mail error carries the addresses in its message,
 * `response` and `rejected`. So the kind of error decides what is kept:
 * - Every error: its name, the code of the driver error underneath (Drizzle wraps it as `cause`), and the mail
 *   server's reply code and command. Its message and stack stay out.
 * - A ValidationError: also the paths of the fields it refused. Its messages could echo what was entered.
 * - A TypeError, RangeError or ReferenceError: also the stack, so a bug in our own code still has a location.
 * The stack is never edited to cut the message out; only these kinds of error show theirs.
 */
export function loggableError(err: unknown): LoggableError {
  if (!isRecord(err)) return { name: "unknown" };
  const name = typeof err.name === "string" ? err.name : "unknown";
  const cause = isRecord(err.cause) ? err.cause : {};
  // Plain values only: an object a library attached to the error could hold what must stay out of the log.
  return {
    name,
    code: [cause.code, err.code].find(isCode),
    responseCode: typeof err.responseCode === "number" ? err.responseCode : undefined,
    command: typeof err.command === "string" ? err.command : undefined,
    paths: name === "ValidationError" ? fieldPaths(err) : undefined,
    stack: BUGS.has(name) && typeof err.stack === "string" ? err.stack : undefined,
  };
}
