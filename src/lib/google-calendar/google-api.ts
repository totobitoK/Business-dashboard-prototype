import {
  GOOGLE_CALENDAR_API,
  GOOGLE_OAUTH_TOKEN_URL,
  IMPORT_WINDOW_FUTURE_DAYS,
  IMPORT_WINDOW_PAST_DAYS,
} from "./config";

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export type GoogleCalendarListEntry = {
  id: string;
  summary: string;
  accessRole?: string;
};

export type GoogleEventItem = {
  id: string;
  status?: string;
  summary?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`TOKEN_EXCHANGE_FAILED:${res.status}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`TOKEN_REFRESH_FAILED:${res.status}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<{
  sub: string;
  email: string;
}> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`USERINFO_FAILED:${res.status}`);
  const data = (await res.json()) as { sub: string; email: string };
  return { sub: data.sub, email: data.email };
}

export async function listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const items: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${GOOGLE_CALENDAR_API}/users/me/calendarList`);
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`CALENDAR_LIST_FAILED:${res.status}`);
    const json = (await res.json()) as {
      items?: GoogleCalendarListEntry[];
      nextPageToken?: string;
    };
    items.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return items;
}

export function importWindowBounds(now = new Date()): { timeMin: string; timeMax: string } {
  const min = new Date(now);
  min.setUTCDate(min.getUTCDate() - IMPORT_WINDOW_PAST_DAYS);
  const max = new Date(now);
  max.setUTCDate(max.getUTCDate() + IMPORT_WINDOW_FUTURE_DAYS);
  return { timeMin: min.toISOString(), timeMax: max.toISOString() };
}

export async function listEventsPage(params: {
  accessToken: string;
  calendarId: string;
  syncToken?: string | null;
  pageToken?: string;
  now?: Date;
}): Promise<{
  items: GoogleEventItem[];
  nextPageToken?: string;
  nextSyncToken?: string;
}> {
  const url = new URL(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(params.calendarId)}/events`
  );
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("showDeleted", "true");

  if (params.syncToken) {
    url.searchParams.set("syncToken", params.syncToken);
  } else {
    const { timeMin, timeMax } = importWindowBounds(params.now);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
  }
  if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (res.status === 410) {
    throw new Error("SYNC_TOKEN_EXPIRED");
  }
  if (!res.ok) {
    throw new Error(`EVENTS_LIST_FAILED:${res.status}`);
  }
  const json = (await res.json()) as {
    items?: GoogleEventItem[];
    nextPageToken?: string;
    nextSyncToken?: string;
  };
  return {
    items: json.items ?? [],
    nextPageToken: json.nextPageToken,
    nextSyncToken: json.nextSyncToken,
  };
}
