import { inspect } from "node:util";
import { ValidationError } from "payload";
import { describe, expect, it } from "vitest";
import { loggableError } from "@/cms/log";

const name = "Teszt Elek";
const email = "teszt.elek@example.com";
const phone = "+36 30 123 4567";
const note = "Allergiás vagyok a festékre";

/** Everything a logger could print of a value: error messages, stacks and extra properties included. */
const printed = (value: unknown) => inspect(value, { depth: null });

function expectNoVisitorData(value: unknown) {
  for (const detail of [name, email, phone, note]) expect(printed(value)).not.toContain(detail);
}

describe("loggableError", () => {
  it("keeps what a mail server's refusal says about the failure, not whom the mail was for", () => {
    const reply = `550 5.1.1 <${email}>: Recipient address rejected: User unknown`;
    // The shape nodemailer gives an SMTP refusal (checked against a real one).
    const refusal = Object.assign(new Error(`Can't send mail - all recipients were rejected: ${reply}`), {
      code: "EENVELOPE",
      response: reply,
      responseCode: 550,
      command: "RCPT TO",
      rejected: [email],
      rejectedErrors: [{ code: "EENVELOPE", response: reply, responseCode: 550, command: "RCPT TO", recipient: email }],
    });
    expect(printed(refusal)).toContain(email);

    const logged = loggableError(refusal);

    expect(logged).toEqual({ name: "Error", code: "EENVELOPE", responseCode: 550, command: "RCPT TO" });
    expectNoVisitorData(logged);
  });

  it("keeps the driver's code of a failed query, not the parameters Drizzle appends to its message", () => {
    const query = 'insert into "bookings" ("name", "email", "phone", "note") values (?, ?, ?, ?)';
    const params = [name, email, phone, note];
    // The shape of Drizzle's query error (checked against a real one): the driver's error is its cause.
    const driver = Object.assign(new Error("SQLITE_BUSY: database is locked"), { code: "SQLITE_BUSY", rawCode: 5 });
    const failed = Object.assign(new Error(`Failed query: ${query}\nparams: ${params.join(",")}`, { cause: driver }), {
      query,
      params,
    });
    expect(printed(failed)).toContain(email);

    const logged = loggableError(failed);

    expect(logged).toEqual({ name: "Error", code: "SQLITE_BUSY" });
    expectNoVisitorData(logged);
  });

  it("uses the error's own code when its cause has none", () => {
    const wrapped = Object.assign(new Error("wrapped", { cause: new Error("no code") }), { code: "ETIMEDOUT" });
    expect(loggableError(wrapped)).toEqual({ name: "Error", code: "ETIMEDOUT" });
  });

  it("keeps the field names of a validation error, never what was entered", () => {
    // What Payload throws when a field fails its validation. The paths are ours; a message could echo the input.
    const refused = new ValidationError({
      collection: "bookings",
      errors: [
        { path: "email", message: `${email} is not a valid address` },
        { path: "phone", message: `${phone} is not a valid number` },
      ],
    });
    expect(printed(refused)).toContain(email);

    const logged = loggableError(refused);

    expect(logged).toEqual({ name: "ValidationError", paths: ["email", "phone"] });
    expectNoVisitorData(logged);
  });

  it("ignores validation data that is not a list of field names", () => {
    const refusedWith = (data: unknown) => Object.assign(new Error("odd"), { name: "ValidationError", data });
    const odd = [
      refusedWith({ errors: [{ path: { of: email } }, { path: 5 }, { path: null }, { message: name }, null, phone] }),
      refusedWith({ errors: `${name} ${phone}` }),
      refusedWith({ errors: [] }),
      refusedWith(null),
    ];
    for (const refused of odd) expect(loggableError(refused)).toEqual({ name: "ValidationError" });
  });

  it("keeps the stack of a bug in our own code, so it still has a location", () => {
    const bugs = [
      new TypeError("x.map is not a function"),
      new RangeError("Invalid time value"),
      new ReferenceError("y is not defined"),
    ];
    for (const bug of bugs) {
      const logged = loggableError(bug);
      expect(logged).toEqual({ name: bug.name, stack: bug.stack });
      expect(logged.stack).toContain("log.test.ts");
    }
  });

  it("keeps no stack of a SyntaxError: JSON.parse quotes the text it choked on", () => {
    const parsing = (() => {
      try {
        return JSON.parse(name);
      } catch (err) {
        return err;
      }
    })();
    expect(parsing).toBeInstanceOf(SyntaxError);
    expect(printed(parsing)).toContain(name);

    const logged = loggableError(parsing);

    expect(logged).toEqual({ name: "SyntaxError" });
    expectNoVisitorData(logged);
  });

  it("keeps neither the message nor the stack of a plain error", () => {
    const failed = new Error(`Could not store ${name} <${email}>`);
    expect(printed(failed)).toContain(email);

    const logged = loggableError(failed);

    expect(logged).toEqual({ name: "Error" });
    expect(logged).not.toHaveProperty("message");
    expectNoVisitorData(logged);
  });

  it("drops what is not a plain code, name or command", () => {
    const odd = Object.assign(new Error("odd"), {
      name: { of: name },
      code: { recipient: email },
      responseCode: `550 ${email}`,
      command: { line: `RCPT TO:<${email}>` },
      cause: { code: [phone] },
    });

    const logged = loggableError(odd);

    expect(logged).toEqual({ name: "unknown" });
    expectNoVisitorData(logged);
  });

  it("says nothing about a value that is not an error", () => {
    for (const thrown of [`failed for ${email}`, null, undefined, 42]) {
      expect(loggableError(thrown)).toEqual({ name: "unknown" });
    }
  });
});
