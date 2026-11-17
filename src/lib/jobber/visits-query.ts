/**
 * Dated visits in a window. Unscheduled visits have null startAt and endAt, so
 * this filter does not return them. GraphiQL still needs to confirm how to page
 * unscheduled visits without reading the whole account, and whether `title`
 * and `assignedUsers` match this selection set on the active API version.
 */
export const JOBBER_VISITS_IN_WINDOW_QUERY = `
  query JobberVisitsInWindow($first: Int!, $after: String, $startAfter: ISO8601DateTime!, $startBefore: ISO8601DateTime!) {
    visits(
      first: $first
      after: $after
      filter: { startAt: { after: $startAfter, before: $startBefore } }
    ) {
      nodes {
        id
        title
        startAt
        endAt
        allDay
        isComplete
        completedAt
        client { name }
        job { id jobNumber title }
        assignedUsers(first: 10) {
          nodes { id name { full } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;
