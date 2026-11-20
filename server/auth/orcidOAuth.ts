import { randomUUID } from "node:crypto";
import { getDb, runTransaction } from "../db.js";
import { fetchOrcidCorpus, mapOrcidWorksToCanonical } from "../orcid_importer.js";

export function isOrcidOAuthConfigured(): boolean {
  return Boolean((process.env.ORCID_CLIENT_ID || "").trim() && (process.env.ORCID_CLIENT_SECRET || "").trim());
}

export function getOrcidBaseUrl(): string {
  return process.env.ORCID_SANDBOX === "true" ? "https://sandbox.orcid.org" : "https://orcid.org";
}

export function getOrcidRedirectUri(): string {
  const port = process.env.PORT || "3000";
  return (process.env.ORCID_REDIRECT_URI || `http://localhost:${port}/api/auth/orcid/callback`).trim();
}

export function buildOrcidAuthorizeUrl(state: string): string {
  const clientId = (process.env.ORCID_CLIENT_ID || "").trim();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "/authenticate",
    redirect_uri: getOrcidRedirectUri(),
    state,
  });
  return `${getOrcidBaseUrl()}/oauth/authorize?${params.toString()}`;
}

export async function exchangeOrcidCode(code: string): Promise<{ orcid: string; name: string; accessToken: string }> {
  const clientId = (process.env.ORCID_CLIENT_ID || "").trim();
  const clientSecret = (process.env.ORCID_CLIENT_SECRET || "").trim();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: getOrcidRedirectUri(),
  });

  const res = await fetch(`${getOrcidBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !data.orcid) {
    throw new Error(String(data.error_description || data.error || "ORCID token exchange failed."));
  }

  return {
    orcid: String(data.orcid),
    name: String(data.name || data.orcid),
    accessToken: String(data.access_token || ""),
  };
}

/**
 * Automatically fetches the researcher's ORCID works, enriches metadata via OpenAlex/Crossref,
 * and creates a ready-to-analyze Corpus dataset in the active project if one doesn't exist yet.
 */
export async function autoBuildOrcidCorpus(orcid: string): Promise<{ datasetId: string; count: number } | null> {
  try {
    const db = getDb();
    const project = db.prepare("SELECT id FROM projects ORDER BY created_at ASC LIMIT 1").get() as { id: string } | undefined;
    if (!project) return null;

    const existing = db
      .prepare("SELECT id FROM datasets WHERE project_id = ? AND source_file LIKE ? LIMIT 1")
      .get(project.id, `%orcid:${orcid}%`) as { id: string } | undefined;
    if (existing) {
      return { datasetId: existing.id, count: 0 };
    }

    const profile = await fetchOrcidCorpus(orcid, { enrichOpenAlex: true });
    if (!profile.works || profile.works.length === 0) return null;

    const canonicalDocs = mapOrcidWorksToCanonical(profile, profile.works);
    const datasetId = randomUUID();
    const now = new Date().toISOString();
    const datasetName = `ORCID Corpus — ${profile.name || orcid}`;

    runTransaction(db, () => {
      db.prepare(
        "INSERT INTO datasets (id, project_id, name, source_file, source_format, record_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(datasetId, project.id, datasetName, `orcid:${orcid}`, "orcid_openalex", canonicalDocs.length, now);

      const insertDoc = db.prepare(`
        INSERT INTO documents (
          id, dataset_id, title, authors, year, source, doi, abstract,
          author_keywords, index_keywords, references_raw, cited_by,
          document_type, language, affiliations, country, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const doc of canonicalDocs) {
        insertDoc.run(
          randomUUID(),
          datasetId,
          doc.title || "Untitled",
          Array.isArray(doc.authors) ? doc.authors.join("; ") : String(doc.authors || ""),
          doc.year ?? null,
          doc.source || "",
          doc.doi || "",
          doc.abstract || "",
          Array.isArray(doc.author_keywords) ? doc.author_keywords.join("; ") : "",
          Array.isArray(doc.index_keywords) ? doc.index_keywords.join("; ") : "",
          Array.isArray(doc.references) ? doc.references.join("\n") : "",
          Number(doc.cited_by || 0),
          doc.document_type || "Article",
          doc.language || "English",
          Array.isArray(doc.affiliations) ? doc.affiliations.join("; ") : "",
          doc.country || "",
          JSON.stringify(doc)
        );
      }
    });

    return { datasetId, count: canonicalDocs.length };
  } catch (err) {
    console.warn("[ORCID Auto-Corpus] Background sync skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}
