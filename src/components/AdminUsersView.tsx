import { type FormEvent, useEffect, useState, useMemo, useRef } from "react";
import {
  UserPlus,
  UserX,
  UserCheck,
  RotateCcw,
  ShieldAlert,
  KeyRound,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Search,
  Users,
  ClipboardPaste,
} from "lucide-react";
import { type AuthUser, useAuth } from "../context/AuthContext.js";
import { apiJson, apiRequest, getApiErrorMessage } from "../utils/apiClient.js";
import {
  AlertBanner,
  Button,
  Card,
  Input,
  SectionHeader,
  Select,
  StatusBadge,
  Tabs,
} from "./CommonUI.js";

type ResetSecret = { email: string; reset_token: string; expires_at: string };
type ProvisionTab = "single" | "bulk";

interface BulkCandidateRow {
  rowNumber: number;
  email: string;
  password: string;
  role: AuthUser["role"];
  valid: boolean;
  validationError?: string;
  importStatus?: "pending" | "success" | "failed";
  importMessage?: string;
}

// Zero-dependency browser reader for .xlsx (OpenXML ZIP) and .csv/.tsv files
async function parseSpreadsheetFile(
  file: File
): Promise<Array<{ email: string; password: string; role: string }>> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx")) {
    const text = await file.text();
    return parseDelimitedText(text);
  }

  // Extract xl/sharedStrings.xml and xl/worksheets/sheet1.xml from .xlsx ZIP archive
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = await extractZipXmlEntries(buf);
  const sharedStringsXml = entries["xl/sharedstrings.xml"] || "";
  const sheetXml =
    entries["xl/worksheets/sheet1.xml"] ||
    Object.entries(entries).find(([k]) => k.startsWith("xl/worksheets/sheet"))?.[1] ||
    "";

  if (!sheetXml) {
    throw new Error("Could not locate worksheet data inside the .xlsx archive.");
  }

  const parser = new DOMParser();
  const sharedStrings: string[] = [];
  if (sharedStringsXml) {
    const ssDoc = parser.parseFromString(sharedStringsXml, "application/xml");
    const siNodes = Array.from(ssDoc.getElementsByTagName("si"));
    for (const si of siNodes) {
      const tNodes = Array.from(si.getElementsByTagName("t"));
      sharedStrings.push(tNodes.map((t) => t.textContent || "").join(""));
    }
  }

  const sheetDoc = parser.parseFromString(sheetXml, "application/xml");
  const rowNodes = Array.from(sheetDoc.getElementsByTagName("row"));
  const matrix: string[][] = [];

  for (const row of rowNodes) {
    const cells = Array.from(row.getElementsByTagName("c"));
    const rowVals: string[] = [];
    for (const c of cells) {
      const ref = c.getAttribute("r") || "";
      const colLetters = ref.replace(/[0-9]/g, "");
      const colIdx = colLetters ? columnLettersToIndex(colLetters) : rowVals.length;
      const cellType = c.getAttribute("t") || "";
      let val = "";
      if (cellType === "inlineStr") {
        val = Array.from(c.getElementsByTagName("t"))
          .map((t) => t.textContent || "")
          .join("");
      } else {
        const vNode = c.getElementsByTagName("v")[0];
        const raw = vNode?.textContent || "";
        if (cellType === "s") {
          val = sharedStrings[Number(raw)] ?? "";
        } else {
          val = raw;
        }
      }
      rowVals[colIdx] = val.trim();
    }
    matrix.push(rowVals);
  }

  if (matrix.length === 0) return [];
  const headers = matrix[0].map((h) => (h || "").trim().toLowerCase());
  const hasHeader = headers.some((h) =>
    ["email", "e-mail", "institutional_email", "password", "role"].includes(h)
  );
  const startRow = hasHeader ? 1 : 0;
  const emailIdx = hasHeader
    ? headers.findIndex((h) => ["email", "e-mail", "institutional_email", "user_email"].includes(h))
    : 0;
  const passIdx = hasHeader
    ? headers.findIndex((h) => ["password", "temp_password", "temporary_password", "pass"].includes(h))
    : 1;
  const roleIdx = hasHeader
    ? headers.findIndex((h) => ["role", "user_role", "access_role"].includes(h))
    : 2;

  return matrix.slice(startRow).map((r) => ({
    email: emailIdx >= 0 ? r[emailIdx] || "" : r[0] || "",
    password: passIdx >= 0 ? r[passIdx] || "" : r[1] || "",
    role: roleIdx >= 0 ? r[roleIdx] || "user" : r[2] || "user",
  }));
}

function columnLettersToIndex(letters: string): number {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(0, col - 1);
}

function parseDelimitedText(
  text: string
): Array<{ email: string; password: string; role: string }> {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes("\t")
    ? "\t"
    : lines[0].includes(";")
    ? ";"
    : ",";

  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const firstCells = splitLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = firstCells.some((h) =>
    ["email", "e-mail", "password", "role"].includes(h)
  );
  const start = hasHeader ? 1 : 0;
  const emailIdx = hasHeader
    ? firstCells.findIndex((h) => ["email", "e-mail", "institutional_email"].includes(h))
    : 0;
  const passIdx = hasHeader
    ? firstCells.findIndex((h) => ["password", "temp_password", "pass"].includes(h))
    : 1;
  const roleIdx = hasHeader
    ? firstCells.findIndex((h) => ["role", "user_role"].includes(h))
    : 2;

  return lines.slice(start).map((line) => {
    const cells = splitLine(line);
    return {
      email: emailIdx >= 0 ? cells[emailIdx] || "" : cells[0] || "",
      password: passIdx >= 0 ? cells[passIdx] || "" : cells[1] || "",
      role: roleIdx >= 0 ? cells[roleIdx] || "user" : cells[2] || "user",
    };
  });
}

async function extractZipXmlEntries(zipBytes: Uint8Array): Promise<Record<string, string>> {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  const decoder = new TextDecoder("utf-8");
  const result: Record<string, string> = {};
  let offset = 0;

  while (offset + 30 <= zipBytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;
    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameBytes = zipBytes.slice(offset + 30, offset + 30 + fileNameLen);
    const entryName = decoder.decode(nameBytes).toLowerCase();
    const dataStart = offset + 30 + fileNameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zipBytes.length) break;

    if (entryName.endsWith(".xml")) {
      const slice = zipBytes.slice(dataStart, dataEnd);
      if (compression === 0) {
        result[entryName] = decoder.decode(slice);
      } else if (compression === 8 && typeof DecompressionStream !== "undefined") {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        void writer.write(slice);
        void writer.close();
        const decompressed = await new Response(ds.readable).arrayBuffer();
        result[entryName] = decoder.decode(decompressed);
      }
    }
    offset = dataEnd;
  }
  return result;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminUsersView() {
  const { user, authEnabled } = useAuth();
  if (!authEnabled || user?.role !== "admin") return null;
  return <AdminUsers actorId={user.id} />;
}

function AdminUsers({ actorId }: { actorId: string }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [provisionTab, setProvisionTab] = useState<ProvisionTab>("single");

  // Single user form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AuthUser["role"]>("user");

  // Bulk provisioning state
  const [bulkRows, setBulkRows] = useState<BulkCandidateRow[]>([]);
  const [bulkSourceName, setBulkSourceName] = useState<string>("");
  const [pasteText, setPasteText] = useState<string>("");
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [bulkImporting, setBulkImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Table filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");

  // Feedback & security state
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<ResetSecret | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ users: AuthUser[] }>("/api/admin/users", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setUsers(data.users);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(getApiErrorMessage(err, "Could not load users."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!secret) return;
    const timer = window.setTimeout(
      () => setSecret(null),
      Math.max(0, Date.parse(secret.expires_at) - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [secret]);

  const run = async (operation: () => Promise<void>) => {
    if (busy || secret) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (err) {
      setError(getApiErrorMessage(err, "Account request failed."));
    } finally {
      setBusy(false);
    }
  };

  const replaceUser = (user: AuthUser) =>
    setUsers((current) => current.map((item) => (item.id === user.id ? user : item)));

  const urlFor = (user: AuthUser) => `/api/admin/users/${encodeURIComponent(user.id)}`;

  const create = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const data = await apiJson<{ user: AuthUser }>("/api/admin/users", {
        email: email.trim(),
        password,
        role,
      });
      setUsers((current) => [...current, data.user]);
      setEmail("");
      setPassword("");
      setRole("user");
      setNotice("User created. Share the temporary password through a trusted private channel.");
    });
  };

  const update = (user: AuthUser, patch: { active?: boolean; role?: AuthUser["role"] }) =>
    void run(async () => {
      const data = await apiJson<{ user: AuthUser }>(urlFor(user), patch, { method: "PATCH" });
      replaceUser(data.user);
      setNotice("Account updated.");
    });

  const remove = (user: AuthUser) => {
    if (
      !window.confirm(
        `Remove access for ${user.email}? The account will be disabled, not permanently deleted.`
      )
    )
      return;
    void run(async () => {
      await apiRequest(urlFor(user), { method: "DELETE" });
      replaceUser({ ...user, active: false });
      setNotice("Account access removed. Audit history is retained.");
    });
  };

  const reset = (user: AuthUser) => {
    if (
      !window.confirm(
        `Issue a single-use reset token for ${user.email}? Existing sessions will be revoked.`
      )
    )
      return;
    void run(async () => {
      const data = await apiJson<{ reset_token: string; expires_at: string }>(
        `${urlFor(user)}/password-reset`,
        {}
      );
      replaceUser({ ...user, must_change_password: true });
      setSecret({ email: user.email, ...data });
    });
  };

  // Validate and normalize raw rows parsed from Excel / CSV / Paste
  const validateCandidateRecords = (
    rawRecords: Array<{ email?: string; password?: string; role?: string }>,
    sourceLabel: string
  ) => {
    setError("");
    setNotice("");
    const existingEmails = new Set(users.map((u) => u.email.trim().toLowerCase()));
    const seenInBatch = new Set<string>();

    const validated: BulkCandidateRow[] = rawRecords
      .filter((r) => (r.email || "").trim() || (r.password || "").trim())
      .map((r, index) => {
        const cleanEmail = String(r.email ?? "").trim();
        const lowerEmail = cleanEmail.toLowerCase();
        const rawPass = String(r.password ?? "").trim();
        const rawRole = String(r.role ?? "user").trim().toLowerCase();
        const normalizedRole: AuthUser["role"] =
          rawRole === "admin" || rawRole === "administrator" ? "admin" : "user";

        let validationError: string | undefined;
        if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
          validationError = "Invalid institutional email format";
        } else if (existingEmails.has(lowerEmail)) {
          validationError = "Email already exists in system";
        } else if (seenInBatch.has(lowerEmail)) {
          validationError = "Duplicate email within uploaded batch";
        } else if (rawPass.length < 12) {
          validationError = "Password must be at least 12 characters";
        }

        if (cleanEmail) seenInBatch.add(lowerEmail);

        return {
          rowNumber: index + 1,
          email: cleanEmail,
          password: rawPass,
          role: normalizedRole,
          valid: !validationError,
          validationError,
          importStatus: "pending",
        };
      });

    setBulkRows(validated);
    setBulkSourceName(sourceLabel);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const mapped = await parseSpreadsheetFile(file);
      validateCandidateRecords(mapped, file.name);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not parse spreadsheet: ${err.message}`
          : "Could not parse uploaded spreadsheet."
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleParsePaste = () => {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const parsed = lines
      .filter((line, idx) => {
        if (idx === 0 && line.toLowerCase().startsWith("email")) return false;
        return true;
      })
      .map((line) => {
        const parts = line.split(/[\t,;]+/).map((p) => p.trim());
        return {
          email: parts[0] || "",
          password: parts[1] || "",
          role: parts[2] || "user",
        };
      });

    validateCandidateRecords(parsed, "Pasted Tabular List");
    setShowPasteBox(false);
  };

  const downloadExcelTemplate = () => {
    // Generate Excel-compatible UTF-8 BOM CSV/XLS spreadsheet directly without external library
    const xlsHtml =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">` +
      `<head><meta charset="UTF-8"></head><body><table>` +
      `<tr><th>email</th><th>password</th><th>role</th></tr>` +
      `<tr><td>alice.researcher@university.edu</td><td>TempPass#2026_Alice</td><td>user</td></tr>` +
      `<tr><td>bob.lead@university.edu</td><td>TempPass#2026_Bob99</td><td>admin</td></tr>` +
      `</table></body></html>`;
    const blob = new Blob(["\uFEFF" + xlsHtml], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sciai_bulk_users_template.xls";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadCsvTemplate = () => {
    const csv =
      "email,password,role\n" +
      "alice.researcher@university.edu,TempPass#2026_Alice,user\n" +
      "bob.lead@university.edu,TempPass#2026_Bob99,admin\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sciai_bulk_users_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const executeBulkImport = async () => {
    const validCandidates = bulkRows.filter(
      (r) => r.valid && r.importStatus !== "success"
    );
    if (validCandidates.length === 0 || bulkImporting) return;

    setBulkImporting(true);
    setError("");
    setNotice("");
    let createdCount = 0;
    let failedCount = 0;

    for (const candidate of validCandidates) {
      try {
        const data = await apiJson<{ user: AuthUser }>("/api/admin/users", {
          email: candidate.email,
          password: candidate.password,
          role: candidate.role,
        });
        createdCount++;
        setUsers((current) => [...current, data.user]);
        setBulkRows((prev) =>
          prev.map((r) =>
            r.rowNumber === candidate.rowNumber
              ? { ...r, importStatus: "success", importMessage: "Created" }
              : r
          )
        );
      } catch (err) {
        failedCount++;
        const msg = getApiErrorMessage(err, "Failed to create account");
        setBulkRows((prev) =>
          prev.map((r) =>
            r.rowNumber === candidate.rowNumber
              ? { ...r, importStatus: "failed", importMessage: msg }
              : r
          )
        );
      }
    }

    setBulkImporting(false);
    if (createdCount > 0) {
      setNotice(
        `Bulk provisioning completed: ${createdCount} account(s) created${
          failedCount > 0 ? `, ${failedCount} failed` : ""
        }. Share temporary passwords securely.`
      );
    } else if (failedCount > 0) {
      setError(`Bulk provisioning failed for ${failedCount} account(s).`);
    }
  };

  const validPendingCount = useMemo(
    () => bulkRows.filter((r) => r.valid && r.importStatus !== "success").length,
    [bulkRows]
  );

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === "active" && !u.active) return false;
      if (statusFilter === "disabled" && u.active) return false;
      if (
        searchQuery.trim() &&
        !u.email.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [users, searchQuery, statusFilter]);

  const disabled = busy || loading || bulkImporting || Boolean(secret);

  return (
    <section className="space-y-6">
      {/* Canonical Editorial Header (Design System §2) */}
      <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-5 lg:flex-row lg:items-end">
        <div>
          <p className="sciai-kicker mb-1">Governance &amp; Access Control</p>
          <h1 className="text-xl font-black tracking-tight text-ink-primary">
            User Administration
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">
            Create individual or bulk researcher accounts via Excel/CSV, manage
            institutional roles, and issue single-use password resets.
          </p>
        </div>

        <Tabs<ProvisionTab>
          value={provisionTab}
          onChange={(tab) => setProvisionTab(tab)}
          items={[
            { id: "single", label: "Single Account" },
            {
              id: "bulk",
              label: "Bulk Import (Excel / CSV)",
              count: bulkRows.length > 0 ? bulkRows.length : undefined,
            },
          ]}
        />
      </div>

      {/* Feedback Alerts */}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      {/* Single-Use Secret Token Disclosure */}
      {secret && (
        <div
          role="region"
          aria-label="Single-use reset token"
          className="rounded-2xl border border-status-warning-border bg-status-warning-bg p-5 shadow-card"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-status-warning-text/10 p-2 text-status-warning-text">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink-primary">
                Reset token for {secret.email}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                Copy this token now and share it through a trusted private channel. It cannot be
                retrieved after dismissal. The user must choose &ldquo;Use a password reset token&rdquo;
                on the sign-in page, then sign in manually.
              </p>

              <label className="mt-3 block space-y-1.5">
                <span className="block text-xs font-bold text-ink-secondary">
                  Single-use token
                </span>
                <input
                  readOnly
                  autoComplete="off"
                  spellCheck={false}
                  value={secret.reset_token}
                  onFocus={(event) => event.target.select()}
                  className="w-full rounded-xl border border-status-warning-border bg-surface-canvas px-3.5 py-2.5 font-mono text-xs text-ink-primary focus:border-brand-500 focus:outline-none"
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="tabular-metrics text-xs font-medium text-status-warning-text">
                  Expires {new Date(secret.expires_at).toLocaleString("en-US")}.
                </p>
                <Button type="button" variant="primary" size="sm" onClick={() => setSecret(null)}>
                  Dismiss and clear token
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: SINGLE ACCOUNT PROVISIONING */}
      {provisionTab === "single" && (
        <Card padding="md">
          <SectionHeader
            kicker="Provisioning"
            title="Provision Researcher Account"
            description="Assign an institutional email and a temporary password (minimum 12 characters)."
          />
          <form onSubmit={create} className="mt-4">
            <fieldset
              disabled={disabled}
              className="grid items-end gap-3.5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_170px_auto]"
            >
              <Input
                label="Email"
                required
                type="email"
                autoComplete="off"
                placeholder="researcher@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Temporary password (12+ characters)"
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                placeholder="Minimum 12 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Select
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as AuthUser["role"])}
              >
                <option value="user">User</option>
                <option value="admin">Administrator</option>
              </Select>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={<UserPlus className="h-4 w-4" />}
                className="w-full lg:w-auto"
              >
                Create user
              </Button>
            </fieldset>
          </form>
        </Card>
      )}

      {/* TAB 2: BULK USER PROVISIONING (EXCEL / CSV / PASTE) */}
      {provisionTab === "bulk" && (
        <Card padding="md" className="space-y-4">
          <div className="flex flex-col justify-between gap-3 border-b border-border-default pb-4 lg:flex-row lg:items-center">
            <div>
              <p className="sciai-kicker">Batch Onboarding</p>
              <h2 className="mt-0.5 text-base font-bold tracking-tight text-ink-primary">
                Bulk Account Provisioning (Excel, CSV &amp; Tabular Paste)
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                Upload an <code>.xlsx</code>, <code>.xls</code>, or <code>.csv</code> file with columns{" "}
                <code className="font-mono text-ink-primary">email</code>,{" "}
                <code className="font-mono text-ink-primary">password</code> (12+ chars), and{" "}
                <code className="font-mono text-ink-primary">role</code> (user/admin).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={downloadExcelTemplate}
                icon={<Download className="h-3.5 w-3.5 text-status-success-text" />}
              >
                Excel Template (.xls)
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={downloadCsvTemplate}
                icon={<Download className="h-3.5 w-3.5" />}
              >
                CSV Template (.csv)
              </Button>
            </div>
          </div>

          {/* Upload & Paste Action Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border-default bg-surface-subtle p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-ink-primary">
                  {bulkSourceName
                    ? `Loaded: ${bulkSourceName}`
                    : "Select an Excel (.xlsx / .xls) or CSV file"}
                </p>
                <p className="text-[11px] text-ink-muted">
                  Parsed locally in your browser with automatic duplicate and password length checks
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                icon={<Upload className="h-3.5 w-3.5" />}
              >
                Upload Excel / CSV
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => setShowPasteBox((v) => !v)}
                icon={<ClipboardPaste className="h-3.5 w-3.5" />}
              >
                {showPasteBox ? "Hide Paste Box" : "Paste List"}
              </Button>
            </div>
          </div>

          {/* Optional Paste Textarea */}
          {showPasteBox && (
            <div className="space-y-2 rounded-xl border border-border-default bg-surface-subtle p-3.5">
              <label className="block text-xs font-bold text-ink-secondary">
                Paste rows from Excel or text (format: <code>email, password, role</code> per line)
              </label>
              <textarea
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"researcher1@uni.edu, StrongPass#2026A, user\nresearcher2@uni.edu, StrongPass#2026B, admin"}
                className="w-full rounded-xl border border-border-default bg-surface-canvas p-3 font-mono text-xs text-ink-primary focus:border-brand-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPasteBox(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleParsePaste}
                >
                  Validate Pasted Rows
                </Button>
              </div>
            </div>
          )}

          {/* Validation Preview Table */}
          {bulkRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-ink-primary">
                    Preview ({bulkRows.length} rows)
                  </span>
                  <span className="rounded border border-status-success-border bg-status-success-bg px-2 py-0.5 font-mono text-[10px] font-bold text-status-success-text tabular-metrics">
                    {validPendingCount} Ready to Create
                  </span>
                  {bulkRows.some((r) => !r.valid) && (
                    <span className="rounded border border-status-danger-border bg-status-danger-bg px-2 py-0.5 font-mono text-[10px] font-bold text-status-danger-text tabular-metrics">
                      {bulkRows.filter((r) => !r.valid).length} Invalid
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={bulkImporting}
                    onClick={() => {
                      setBulkRows([]);
                      setBulkSourceName("");
                    }}
                  >
                    Clear List
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={bulkImporting}
                    disabled={validPendingCount === 0 || bulkImporting}
                    onClick={() => void executeBulkImport()}
                    icon={<Users className="h-3.5 w-3.5" />}
                  >
                    {bulkImporting
                      ? "Provisioning Accounts..."
                      : `Create ${validPendingCount} Valid User(s)`}
                  </Button>
                </div>
              </div>

              <div className="max-h-72 overflow-auto rounded-xl border border-border-default">
                <table className="min-w-full text-xs">
                  <thead className="border-b border-border-default bg-surface-subtle">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-ink-secondary">#</th>
                      <th className="px-3 py-2 text-left font-bold text-ink-secondary">Email</th>
                      <th className="px-3 py-2 text-left font-bold text-ink-secondary">Role</th>
                      <th className="px-3 py-2 text-left font-bold text-ink-secondary">
                        Validation / Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {bulkRows.map((row) => (
                      <tr key={row.rowNumber} className="bg-surface-canvas">
                        <td className="px-3 py-2 font-mono text-ink-muted tabular-metrics">
                          {row.rowNumber}
                        </td>
                        <td className="px-3 py-2 font-semibold text-ink-primary">
                          {row.email || <span className="italic text-ink-muted">(empty)</span>}
                        </td>
                        <td className="px-3 py-2 uppercase font-mono text-[11px] text-ink-secondary">
                          {row.role}
                        </td>
                        <td className="px-3 py-2">
                          {row.importStatus === "success" ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-status-success-text">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Created</span>
                            </span>
                          ) : row.importStatus === "failed" ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-status-danger-text">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>{row.importMessage}</span>
                            </span>
                          ) : row.valid ? (
                            <span className="inline-flex items-center gap-1 text-status-success-text">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Valid (Ready)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-status-danger-text">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>{row.validationError}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Accounts Table Filter Toolbar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter accounts by email..."
            className="h-9 w-full rounded-xl border border-border-default bg-surface-canvas pl-8 pr-3 text-xs text-ink-primary focus:border-brand-500 focus:outline-none"
          />
        </div>

        <Tabs<"all" | "active" | "disabled">
          value={statusFilter}
          onChange={(val) => setStatusFilter(val)}
          items={[
            { id: "all", label: "All Accounts", count: users.length },
            {
              id: "active",
              label: "Active",
              count: users.filter((u) => u.active).length,
            },
            {
              id: "disabled",
              label: "Disabled",
              count: users.filter((u) => !u.active).length,
            },
          ]}
        />
      </div>

      {/* Accounts Table */}
      {loading && (
        <p role="status" className="text-xs font-medium text-ink-muted">
          Loading accounts&hellip;
        </p>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="border-b border-border-default bg-surface-subtle">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-ink-secondary">Email</th>
                <th className="px-4 py-3 text-left font-bold text-ink-secondary">Role</th>
                <th className="px-4 py-3 text-left font-bold text-ink-secondary">Status</th>
                <th className="px-4 py-3 text-left font-bold text-ink-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {filteredUsers.map((user) => {
                const isSelf = user.id === actorId;
                return (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-surface-subtle/60"
                  >
                    <td className="px-4 py-3.5 font-semibold text-ink-primary">
                      <span>{user.email}</span>
                      {isSelf && (
                        <span className="ml-2 rounded-md border border-status-info-border bg-status-info-bg px-1.5 py-0.5 text-[10px] font-bold text-status-info-text">
                          (you)
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <select
                        aria-label={`Role for ${user.email}`}
                        value={user.role}
                        disabled={disabled || isSelf}
                        onChange={(e) =>
                          update(user, { role: e.target.value as AuthUser["role"] })
                        }
                        className="rounded-lg border border-border-default bg-surface-canvas px-2.5 py-1.5 text-xs font-medium text-ink-primary transition-colors hover:border-border-strong focus:border-brand-500 focus:outline-none disabled:opacity-50"
                      >
                        <option value="user">User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={user.active ? "Active" : "Disabled"} />
                        {user.must_change_password && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-warning-text">
                            <ShieldAlert className="h-3 w-3" />
                            Password change required
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={disabled || isSelf}
                          onClick={() => update(user, { active: !user.active })}
                          icon={
                            user.active ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )
                          }
                        >
                          {user.active ? "Disable" : "Enable"}
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={disabled || !user.active || isSelf}
                          onClick={() => reset(user)}
                          icon={<RotateCcw className="h-3.5 w-3.5" />}
                        >
                          Reset password
                        </Button>

                        <button
                          type="button"
                          disabled={disabled || !user.active || isSelf}
                          onClick={() => remove(user)}
                          className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-status-danger-border bg-status-danger-bg/60 px-3 text-xs font-semibold text-status-danger-text transition-colors hover:bg-status-danger-bg disabled:pointer-events-none disabled:opacity-50"
                        >
                          Remove access
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && !filteredUsers.length && (
          <p className="p-6 text-center text-xs text-ink-muted">No matching accounts found.</p>
        )}
      </Card>
    </section>
  );
}