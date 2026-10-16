import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll } from "vitest";
import { loadDevSeedCredentials } from "./load-dev-seed-credentials";

const USER_A_EMAIL = "member-a@acme.dev";
const USER_B_EMAIL = "member-b@beta.dev";

function isolationPrerequisites(): { ok: true } | { ok: false; reason: string } {
  if (process.env.RUN_SUPABASE_ISOLATION_TESTS !== "1") {
    return { ok: false, reason: "set RUN_SUPABASE_ISOLATION_TESTS=1" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" };
  }
  const seedCreds = loadDevSeedCredentials();
  if (!seedCreds?.users[USER_A_EMAIL] || !seedCreds?.users[USER_B_EMAIL]) {
    return { ok: false, reason: ".dev-seed-credentials.json (run npm run seed:dev)" };
  }
  return { ok: true };
}

async function signIn(
  url: string,
  publishableKey: string,
  email: string,
  pwd: string
): Promise<SupabaseClient> {
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: pwd });
  if (error) throw error;
  return client;
}

describe("Supabase tenant isolation (authenticated clients)", () => {
  const prereq = isolationPrerequisites();

  if (!prereq.ok) {
    if (process.env.RUN_SUPABASE_ISOLATION_TESTS === "1") {
      it(`missing isolation prerequisites (${prereq.reason})`, () => {
        throw new Error(
          `Isolation tests require ${prereq.reason}. npm run test:isolation must fail when configuration is incomplete.`
        );
      });
    } else {
      it.skip(`skipped — ${prereq.reason}`, () => {});
    }
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const seedCreds = loadDevSeedCredentials()!;
  const passwordA = seedCreds.users[USER_A_EMAIL]!;
  const passwordB = seedCreds.users[USER_B_EMAIL]!;

  let projectAId: string;
  let projectBId: string;
  let companyBId: string;

  beforeAll(async () => {
    const clientA = await signIn(url, publishableKey, USER_A_EMAIL, passwordA);
    const { data: aProjects, error: aErr } = await clientA
      .from("client_projects")
      .select("id, company_id, company_name");
    if (aErr || !aProjects?.length) {
      throw new Error("Seed data missing — run npm run seed:dev first.");
    }
    projectAId = aProjects[0]!.id as string;

    const clientB = await signIn(url, publishableKey, USER_B_EMAIL, passwordB);
    const { data: bProjects, error: bErr } = await clientB
      .from("client_projects")
      .select("id, company_id");
    if (bErr || !bProjects?.length) throw new Error("Beta seed project missing.");
    projectBId = bProjects[0]!.id as string;
    companyBId = bProjects[0]!.company_id as string;
  });

  it("user A reads own project but not company B project by id", async () => {
    const client = await signIn(url, publishableKey, USER_A_EMAIL, passwordA);
    const own = await client.from("client_projects").select("id").eq("id", projectAId).maybeSingle();
    expect(own.error).toBeNull();
    expect(own.data?.id).toBe(projectAId);

    const other = await client.from("client_projects").select("id").eq("id", projectBId).maybeSingle();
    expect(other.data).toBeNull();
  });

  it("user A list query does not include company B projects", async () => {
    const client = await signIn(url, publishableKey, USER_A_EMAIL, passwordA);
    const { data, error } = await client.from("client_projects").select("id");
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(projectAId);
    expect(ids).not.toContain(projectBId);
  });

  it("user A cannot update protected project fields", async () => {
    const client = await signIn(url, publishableKey, USER_A_EMAIL, passwordA);
    const attempt = await client
      .from("client_projects")
      .update({ setup_fee: 99999, status: "archived", company_id: companyBId })
      .eq("id", projectAId)
      .select("id");
    expect(attempt.error || attempt.data?.length === 0).toBeTruthy();
  });

  it("user A cannot insert company membership or platform admin rows", async () => {
    const client = await signIn(url, publishableKey, USER_A_EMAIL, passwordA);
    const {
      data: { user },
    } = await client.auth.getUser();

    const membership = await client.from("company_memberships").insert({
      company_id: companyBId,
      user_id: user!.id,
      role: "owner",
    });
    expect(membership.error).toBeTruthy();

    const admin = await client.from("platform_admins").insert({ user_id: user!.id });
    expect(admin.error).toBeTruthy();
  });

  it("user A cannot record payments", async () => {
    const client = await signIn(url, publishableKey, USER_A_EMAIL, passwordA);
    const { data: project } = await client
      .from("client_projects")
      .select("company_id")
      .eq("id", projectAId)
      .single();
    const payment = await client.from("project_payments").insert({
      project_id: projectAId,
      company_id: project!.company_id,
      payment_date: "2026-01-01",
      amount: 100,
      type: "setup",
    });
    expect(payment.error).toBeTruthy();
  });

  it("user A cannot read admin notes", async () => {
    const client = await signIn(url, publishableKey, USER_A_EMAIL, passwordA);
    const notes = await client.from("admin_project_notes").select("id").limit(1);
    expect(notes.error).toBeTruthy();
  });

  it("user B cannot read user A project", async () => {
    const client = await signIn(url, publishableKey, USER_B_EMAIL, passwordB);
    const other = await client.from("client_projects").select("id").eq("id", projectAId).maybeSingle();
    expect(other.data).toBeNull();
  });
});
