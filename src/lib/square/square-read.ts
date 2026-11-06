import { SQUARE_PAGE_SIZE, type SquareEnvironment } from "./config";
import { collectPages, type SquarePaymentPayload, type SquareRefundPayload } from "./import-transactions";
import { squareGet } from "./square-api";

const LOCATION_ID = /^[A-Za-z0-9]{1,64}$/;
const CURRENCY = /^[A-Z]{3}$/;

export type SquareLocationRecord = {
  square_location_id: string;
  name: string | null;
  status: string | null;
  currency: string | null;
};

export function parseLocations(body: unknown): SquareLocationRecord[] {
  const locations = (body as { locations?: unknown[] } | null)?.locations;
  if (!Array.isArray(locations)) return [];
  return locations.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    if (!LOCATION_ID.test(id)) return [];
    const currency = typeof record.currency === "string" ? record.currency : null;
    return [
      {
        square_location_id: id,
        name: typeof record.name === "string" ? record.name.slice(0, 120) : null,
        status: typeof record.status === "string" ? record.status : null,
        currency: currency && CURRENCY.test(currency) ? currency : null,
      },
    ];
  });
}

export function parseMerchantName(body: unknown): string | null {
  const merchant = (body as { merchant?: { business_name?: string } } | null)?.merchant;
  const name = merchant?.business_name?.trim();
  return name ? name.slice(0, 160) : null;
}

export async function readSellerProfile(params: {
  environment: SquareEnvironment;
  accessToken: string;
  merchantId: string;
}): Promise<{ merchantName: string | null; locations: SquareLocationRecord[] }> {
  const [merchantBody, locationBody] = await Promise.all([
    squareGet({
      environment: params.environment,
      accessToken: params.accessToken,
      path: `/v2/merchants/${encodeURIComponent(params.merchantId)}`,
    }),
    squareGet({
      environment: params.environment,
      accessToken: params.accessToken,
      path: "/v2/locations",
    }),
  ]);
  return {
    merchantName: parseMerchantName(merchantBody),
    locations: parseLocations(locationBody),
  };
}

export async function readLocationActivity(params: {
  environment: SquareEnvironment;
  accessToken: string;
  locationId: string;
  beginTime: string;
  endTime: string;
}): Promise<{ payments: SquarePaymentPayload[]; refunds: SquareRefundPayload[] }> {
  const shared = {
    begin_time: params.beginTime,
    end_time: params.endTime,
    location_id: params.locationId,
    limit: String(SQUARE_PAGE_SIZE),
    sort_order: "ASC",
  };
  const payments = await collectPages(async (cursor) => {
    const body = (await squareGet({
      environment: params.environment,
      accessToken: params.accessToken,
      path: "/v2/payments",
      query: { ...shared, cursor: cursor ?? undefined },
    })) as { payments?: SquarePaymentPayload[]; cursor?: string };
    return { items: body.payments ?? [], cursor: body.cursor ?? null };
  });
  const refunds = await collectPages(async (cursor) => {
    const body = (await squareGet({
      environment: params.environment,
      accessToken: params.accessToken,
      path: "/v2/refunds",
      query: { ...shared, status: "COMPLETED", cursor: cursor ?? undefined },
    })) as { refunds?: SquareRefundPayload[]; cursor?: string };
    return { items: body.refunds ?? [], cursor: body.cursor ?? null };
  });
  return { payments, refunds };
}
