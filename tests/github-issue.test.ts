import { parseOwnerRepo } from "@/lib/github-issue";
import { describe, expect, it } from "vitest";

describe("parseOwnerRepo", () => {
  it("parses owner/repo", () => {
    expect(parseOwnerRepo("acme/cyoa")).toEqual({ owner: "acme", repo: "cyoa" });
  });

  it("rejects invalid values", () => {
    expect(parseOwnerRepo("")).toBeNull();
    expect(parseOwnerRepo("nope")).toBeNull();
    expect(parseOwnerRepo("/repo")).toBeNull();
    expect(parseOwnerRepo("org/")).toBeNull();
    expect(parseOwnerRepo("org/sub/extra")).toBeNull();
  });
});
