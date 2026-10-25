import { describe, expect, it } from "bun:test";
import { orderIssueMove } from "./issueOrdering";

describe("orderIssueMove", () => {
  it("reorders an issue before another issue in the same section", () => {
    expect(orderIssueMove("c", "todo", "todo", ["a", "b", "c"], [], 1)).toEqual(
      {
        position: 1,
        sections: [{ sectionId: "todo", issueIds: ["a", "c", "b"] }],
      },
    );
  });

  it("moves an issue to the requested position in another section", () => {
    expect(
      orderIssueMove("b", "todo", "doing", ["a", "b"], ["c", "d"], 1),
    ).toEqual({
      position: 1,
      sections: [
        { sectionId: "todo", issueIds: ["a"] },
        { sectionId: "doing", issueIds: ["c", "b", "d"] },
      ],
    });
  });

  it("appends when no destination position is provided", () => {
    expect(
      orderIssueMove("b", "todo", "doing", ["a", "b"], ["c"], undefined),
    ).toEqual({
      position: 1,
      sections: [
        { sectionId: "todo", issueIds: ["a"] },
        { sectionId: "doing", issueIds: ["c", "b"] },
      ],
    });
  });

  it("clamps positions beyond the end of the destination section", () => {
    expect(orderIssueMove("a", "todo", "doing", ["a"], ["b"], 20)).toEqual({
      position: 1,
      sections: [
        { sectionId: "todo", issueIds: [] },
        { sectionId: "doing", issueIds: ["b", "a"] },
      ],
    });
  });

  it("does not mutate the supplied issue arrays", () => {
    const sourceIds = ["a", "b"];
    const destinationIds = ["c"];

    orderIssueMove("b", "todo", "doing", sourceIds, destinationIds, 0);

    expect(sourceIds).toEqual(["a", "b"]);
    expect(destinationIds).toEqual(["c"]);
  });

  it("does not duplicate an issue already present in the destination", () => {
    expect(orderIssueMove("b", "todo", "doing", ["b"], ["b", "c"], 0)).toEqual({
      position: 0,
      sections: [
        { sectionId: "todo", issueIds: [] },
        { sectionId: "doing", issueIds: ["b", "c"] },
      ],
    });
  });
});
