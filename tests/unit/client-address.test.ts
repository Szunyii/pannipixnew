import { describe, expect, it } from "vitest";
import { clientAddress } from "@/lib/client-address";

describe("clientAddress", () => {
  it("takes the entry our own proxy added, not the one the visitor sent", () => {
    // The visitor sent "X-Forwarded-For: 6.6.6.6"; the proxy appended the address it actually saw.
    expect(clientAddress("6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientAddress("203.0.113.9")).toBe("203.0.113.9");
  });

  it("counts the trusted hops from the right", () => {
    expect(clientAddress("6.6.6.6, 203.0.113.9, 198.51.100.7", 2)).toBe("203.0.113.9");
    expect(clientAddress("203.0.113.9", 2)).toBeNull();
  });

  it("trusts nothing when hops is below 1", () => {
    expect(clientAddress("203.0.113.9", 0)).toBeNull();
  });

  it.each([
    ["no header", null],
    ["an empty header", ""],
    ["junk", "not-an-address"],
    ["a port glued on", "203.0.113.9:4711"],
    ["an IPv4 loopback", "127.0.0.1"],
    ["an IPv4-mapped loopback, which is what Next fills in when the proxy sent nothing", "::ffff:127.0.0.1"],
    ["an IPv6 loopback", "::1"],
    ["a private address", "10.1.2.3"],
    ["another private range", "172.20.0.5"],
    ["a unique-local IPv6 address", "fd00::1"],
    ["a carrier-grade NAT address, where a host's own proxies may sit", "100.64.1.2"],
    ["the first address of the carrier-grade NAT range", "100.64.0.0"],
    ["the last address of the carrier-grade NAT range", "100.127.255.255"],
    ["one near the end of the carrier-grade NAT range", "100.127.255.254"],
    ["one in the middle of the carrier-grade NAT range", "100.100.100.100"],
    ["an IPv4-mapped carrier-grade NAT address", "::ffff:100.64.1.2"],
  ])("has no address for %s", (_what, header) => {
    expect(clientAddress(header)).toBeNull();
  });

  it.each(["100.63.0.1", "100.128.0.1", "100.0.0.1", "100.200.1.1"])(
    "keeps %s, which lies outside the carrier-grade NAT range",
    (address) => {
      expect(clientAddress(address)).toBe(address);
    },
  );

  it("reads an IPv4-mapped address as the IPv4 one", () => {
    expect(clientAddress("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });

  it("identifies an IPv6 visitor by their /64", () => {
    const a = clientAddress("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = clientAddress("2001:DB8:1:2::1");
    expect(a).toBe("2001:db8:1:2::/64");
    expect(b).toBe(a);
    expect(clientAddress("2001:db8:1:3::1")).not.toBe(a);
  });

  it("expands :: before cutting the prefix", () => {
    expect(clientAddress("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });
});
