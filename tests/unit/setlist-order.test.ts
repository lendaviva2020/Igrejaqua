import { describe, expect, it } from "vitest";
import { moveInOrder } from "@/modules/setlists/schemas";

describe("moveInOrder", () => {
  const ids = ["a", "b", "c"] as const;
  it("sobe um item", () => expect(moveInOrder(ids, "b", "up")).toEqual(["b", "a", "c"]));
  it("desce um item", () => expect(moveInOrder(ids, "b", "down")).toEqual(["a", "c", "b"]));
  it("recusa mover além do início/fim", () => {
    expect(moveInOrder(ids, "a", "up")).toBeNull();
    expect(moveInOrder(ids, "c", "down")).toBeNull();
  });
  it("recusa id inexistente e não muta a entrada", () => {
    expect(moveInOrder(ids, "z", "up")).toBeNull();
    expect(ids).toEqual(["a", "b", "c"]);
  });
});
