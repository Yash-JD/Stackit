export type OrderedIssueSection = {
  sectionId: string;
  issueIds: string[];
};

export function orderIssueMove(
  issueId: string,
  sourceSectionId: string,
  destinationSectionId: string,
  sourceIssueIds: string[],
  destinationIssueIds: string[],
  requestedPosition?: number,
) {
  const sameSection = sourceSectionId === destinationSectionId;
  const sourceIds = sourceIssueIds.filter((id) => id !== issueId);
  const destinationIds = sameSection
    ? [...sourceIds]
    : destinationIssueIds.filter((id) => id !== issueId);
  const position = Math.min(
    requestedPosition ?? destinationIds.length,
    destinationIds.length,
  );

  destinationIds.splice(position, 0, issueId);

  const sections: OrderedIssueSection[] = sameSection
    ? [{ sectionId: sourceSectionId, issueIds: destinationIds }]
    : [
        { sectionId: sourceSectionId, issueIds: sourceIds },
        { sectionId: destinationSectionId, issueIds: destinationIds },
      ];

  return { position, sections };
}
