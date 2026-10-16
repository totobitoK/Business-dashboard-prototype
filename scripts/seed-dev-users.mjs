/**
 * Controlled bootstrap for development tenants.
 *
 * Prefers SUPABASE_SECRET_KEY (Auth Admin API). Without it, writes SQL to
 * supabase/.seed-dev-run.sql for apply via Supabase MCP / psql (service context).
 *
 * Random per-user passwords → .dev-seed-credentials.json (gitignored).
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadEnvLocalFiles } from "./load-env-local.mjs";

loadEnvLocalFiles(process.cwd());

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

const CREDENTIALS_PATH = path.join(process.cwd(), ".dev-seed-credentials.json");
const SQL_PATH = path.join(process.cwd(), "supabase/.seed-dev-run.sql");

const USERS = [
  { email: "admin@ravenview.dev", display: "RavenView Admin", platformAdmin: true },
  { email: "member-a@acme.dev", display: "Acme Owner", companySlug: "acme-hvac", role: "owner" },
  { email: "member-b@beta.dev", display: "Beta Owner", companySlug: "beta-retail", role: "owner" },
];

function randomPassword() {
  return crypto.randomBytes(24).toString("base64url");
}

function uuid() {
  return crypto.randomUUID();
}

function buildCredentials() {
  const credentials = { generatedAt: new Date().toISOString(), users: {} };
  const specs = USERS.map((u) => {
    const id = uuid();
    const password = randomPassword();
    credentials.users[u.email] = password;
    return { ...u, id, password };
  });
  return { credentials, specs };
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSeedSql(specs) {
  const lines = [
    "-- Generated dev seed — do not commit",
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
    "",
  ];

  for (const u of specs) {
    lines.push(`-- ${u.email}`);
    lines.push(`DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = ${sqlLiteral(u.email)});`);
    lines.push(`DELETE FROM auth.users WHERE email = ${sqlLiteral(u.email)};`);
    lines.push(`INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  ${sqlLiteral(u.id)}::uuid,
  'authenticated',
  'authenticated',
  ${sqlLiteral(u.email)},
  crypt(${sqlLiteral(u.password)}, gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', ${sqlLiteral(u.display)}),
  now(),
  now(),
  '', '', '', ''
);`);
    lines.push(`INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  ${sqlLiteral(u.id)}::uuid,
  jsonb_build_object('sub', ${sqlLiteral(u.id)}, 'email', ${sqlLiteral(u.email)}),
  'email',
  ${sqlLiteral(u.id)},
  now(), now(), now()
);`);
    lines.push("");
  }

  const admin = specs.find((s) => s.platformAdmin);
  lines.push(`INSERT INTO public.platform_admins (user_id) VALUES (${sqlLiteral(admin.id)}::uuid)
ON CONFLICT (user_id) DO NOTHING;`);

  const companyAcme = uuid();
  const companyBeta = uuid();
  lines.push(`INSERT INTO public.companies (id, name, slug) VALUES
  (${sqlLiteral(companyAcme)}::uuid, 'Acme Comfort HVAC', 'acme-hvac'),
  (${sqlLiteral(companyBeta)}::uuid, 'Beta Home Retail', 'beta-retail')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;`);

  lines.push(`WITH c AS (SELECT id, slug FROM public.companies WHERE slug IN ('acme-hvac', 'beta-retail'))
INSERT INTO public.company_memberships (company_id, user_id, role)
SELECT c.id, u.uid, u.role::public.company_membership_role FROM c
JOIN (VALUES
  ('acme-hvac', ${sqlLiteral(specs.find((s) => s.companySlug === "acme-hvac").id)}::uuid, 'owner'),
  ('beta-retail', ${sqlLiteral(specs.find((s) => s.companySlug === "beta-retail").id)}::uuid, 'owner')
) AS u(slug, uid, role) ON u.slug = c.slug
ON CONFLICT (company_id, user_id) DO NOTHING;`);

  lines.push(`WITH c AS (SELECT id, slug FROM public.companies WHERE slug IN ('acme-hvac', 'beta-retail'))
INSERT INTO public.client_projects (
  company_id, company_name, contact_name, email, phone, status, setup_fee, monthly_fee, dashboard_scope
)
SELECT c.id, p.company_name, p.contact_name, p.email, p.phone, p.status::public.client_project_status, p.setup_fee, p.monthly_fee, p.dashboard_scope
FROM c
JOIN (VALUES
  ('acme-hvac', 'Acme Comfort HVAC', 'Alex Acme', 'alex@acme-hvac.example', '555-0101', 'active', 2500, 350, 'Operations overview and revenue KPIs (seed data).'),
  ('beta-retail', 'Beta Home Retail', 'Blake Beta', 'blake@beta-retail.example', '555-0202', 'pending', 1800, 275, 'Retail inventory and sales dashboard (seed data).')
) AS p(slug, company_name, contact_name, email, phone, status, setup_fee, monthly_fee, dashboard_scope) ON p.slug = c.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_projects cp WHERE cp.company_id = c.id AND cp.company_name = p.company_name
);`);

  return lines.join("\n");
}

async function seedViaAdminApi(specs) {
  const supabase = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userIds = {};
  for (const u of specs) {
    const { data: listed } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed?.users?.find((x) => x.email === u.email);
    if (existing) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        password: u.password,
      });
      if (error) throw error;
      userIds[u.email] = existing.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { display_name: u.display },
      });
      if (error) throw error;
      userIds[u.email] = data.user.id;
    }
    console.log("User ready:", u.email);
  }

  const companies = [
    { slug: "acme-hvac", name: "Acme Comfort HVAC" },
    { slug: "beta-retail", name: "Beta Home Retail" },
  ];
  const companyIds = {};
  for (const c of companies) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", c.slug)
      .maybeSingle();
    if (existing?.id) {
      companyIds[c.slug] = existing.id;
      continue;
    }
    const { data, error } = await supabase.from("companies").insert(c).select("id").single();
    if (error) throw error;
    companyIds[c.slug] = data.id;
  }

  await supabase.from("platform_admins").upsert({ user_id: userIds["admin@ravenview.dev"] });
  for (const u of specs.filter((x) => x.companySlug)) {
    await supabase.from("company_memberships").upsert({
      company_id: companyIds[u.companySlug],
      user_id: userIds[u.email],
      role: u.role,
    });
  }

  const projects = [
    {
      company_id: companyIds["acme-hvac"],
      company_name: "Acme Comfort HVAC",
      contact_name: "Alex Acme",
      email: "alex@acme-hvac.example",
      phone: "555-0101",
      status: "active",
      setup_fee: 2500,
      monthly_fee: 350,
      dashboard_scope: "Operations overview and revenue KPIs (seed data).",
    },
    {
      company_id: companyIds["beta-retail"],
      company_name: "Beta Home Retail",
      contact_name: "Blake Beta",
      email: "blake@beta-retail.example",
      phone: "555-0202",
      status: "pending",
      setup_fee: 1800,
      monthly_fee: 275,
      dashboard_scope: "Retail inventory and sales dashboard (seed data).",
    },
  ];

  for (const p of projects) {
    const { data: existing } = await supabase
      .from("client_projects")
      .select("id")
      .eq("company_id", p.company_id)
      .eq("company_name", p.company_name)
      .maybeSingle();
    if (existing?.id) continue;
    const { error } = await supabase.from("client_projects").insert(p);
    if (error) throw error;
  }
}

async function main() {
  if (!url) {
    console.error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
    process.exit(1);
  }

  const { credentials, specs } = buildCredentials();
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log("Wrote credentials:", CREDENTIALS_PATH);

  if (secret) {
    await seedViaAdminApi(specs);
    console.log("Seed complete (Admin API).");
    return;
  }

  const sql = buildSeedSql(specs);
  fs.writeFileSync(SQL_PATH, sql + "\n", "utf8");
  console.log("Wrote SQL (apply with service role / Supabase MCP execute_sql):", SQL_PATH);
  console.log("SUPABASE_SECRET_KEY not set — SQL path written for MCP apply.");
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
