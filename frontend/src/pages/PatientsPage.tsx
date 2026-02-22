import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { listPatients, createPatient, type PatientListItem } from "@/api/client";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

function formatLastVisit(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export function PatientsPage() {
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [photoErrors, setPhotoErrors] = useState<Set<string>>(new Set());

  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.trim().toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.date_of_birth && p.date_of_birth.toLowerCase().includes(q)) ||
        (p.mrn && p.mrn.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q))
    );
  }, [patients, search]);

  const totalEncounters = useMemo(
    () => patients.reduce((acc, p) => acc + (p.encounter_count || 0), 0),
    [patients]
  );

  const load = async () => {
    try {
      const list = await listPatients();
      setPatients(list);
      setPhotoErrors(new Set());
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createPatient({
        name: newName.trim(),
        date_of_birth: newDob.trim() || undefined,
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
      });
      setNewName("");
      setNewDob("");
      setNewEmail("");
      setNewPhone("");
      setShowAdd(false);
      await load();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-clinical-bg">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Patients</h1>
            <p className="text-sm text-clinical-muted mt-0.5">{user?.full_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-lg border border-clinical-primary text-clinical-primary px-4 py-2 text-sm font-medium hover:bg-clinical-primary/5 transition-colors"
            >
              Add patient
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="text-sm text-clinical-muted hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {!loading && patients.length > 0 && (
          <div className="flex flex-wrap items-center gap-6 mb-6 text-sm">
            <span className="text-gray-700">
              <span className="font-semibold text-gray-900">{patients.length}</span> patient{patients.length !== 1 ? "s" : ""}
            </span>
            <span className="text-clinical-muted">·</span>
            <span className="text-gray-700">
              <span className="font-semibold text-gray-900">{totalEncounters}</span> total record{totalEncounters !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Search */}
        <div className="mb-8">
          <label htmlFor="patient-search" className="sr-only">
            Search patients
          </label>
          <div className="relative max-w-xl">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clinical-muted" aria-hidden>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              id="patient-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, DOB, MRN, or email…"
              className="w-full rounded-xl border border-clinical-border bg-white py-3.5 pl-12 pr-4 text-sm text-gray-900 placeholder:text-clinical-muted focus:border-clinical-primary focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 shadow-sm"
              aria-label="Search patients"
            />
          </div>
        </div>

        {/* Add patient form */}
        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="mb-8 p-5 rounded-2xl border border-clinical-border bg-white shadow-sm flex flex-wrap items-end gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-clinical-muted mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Patient name"
                className="rounded-lg border border-clinical-border px-3 py-2 text-sm w-48 focus:border-clinical-primary focus:ring-1 focus:ring-clinical-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-clinical-muted mb-1">DOB</label>
              <input
                type="text"
                value={newDob}
                onChange={(e) => setNewDob(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="rounded-lg border border-clinical-border px-3 py-2 text-sm w-36 focus:border-clinical-primary focus:ring-1 focus:ring-clinical-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-clinical-muted mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="patient@example.com"
                className="rounded-lg border border-clinical-border px-3 py-2 text-sm w-52 focus:border-clinical-primary focus:ring-1 focus:ring-clinical-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-clinical-muted mb-1">Phone</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="rounded-lg border border-clinical-border px-3 py-2 text-sm w-40 focus:border-clinical-primary focus:ring-1 focus:ring-clinical-primary"
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-clinical-primary text-white px-4 py-2 text-sm font-medium hover:bg-clinical-primaryHover disabled:opacity-50 transition-colors"
            >
              {adding ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm text-clinical-muted hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Content */}
        {loading ? (
          <div className="rounded-2xl border border-clinical-border bg-white p-12 text-center text-clinical-muted shadow-sm">
            Loading patients…
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-2xl border border-clinical-border bg-white p-12 text-center text-gray-500 shadow-sm">
            <p className="font-medium text-gray-700">No patients yet</p>
            <p className="text-sm text-clinical-muted mt-1">Add a patient to start an encounter.</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="rounded-2xl border border-clinical-border bg-white p-12 text-center text-gray-500 shadow-sm">
            No patients match &quot;{search}&quot;. Try a different search.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map((p) => {
              const lastVisit = formatLastVisit(p.last_encounter_at);
              const subtitle =
                p.date_of_birth || p.mrn
                  ? `${p.date_of_birth || ""} ${p.mrn ? ` · ${p.mrn}` : ""}`.trim()
                  : p.encounter_count
                    ? `${p.encounter_count} record${p.encounter_count !== 1 ? "s" : ""}${lastVisit ? ` · Last visit ${lastVisit}` : ""}`
                    : "No records yet";
              return (
                <Link
                  key={p.id}
                  to={`/patients/${p.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-clinical-border bg-white p-5 shadow-sm transition-all hover:border-clinical-primary/30 hover:shadow-md"
                >
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-clinical-primary/5 text-base font-semibold text-clinical-primary ring-1 ring-clinical-border/50">
                    {p.photo_url && !photoErrors.has(p.id) ? (
                      <img
                        src={p.photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setPhotoErrors((prev) => new Set(prev).add(p.id))}
                      />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full" aria-hidden>
                        {getInitials(p.name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                    <div className="text-sm text-clinical-muted truncate mt-0.5">{subtitle}</div>
                    {p.encounter_count > 0 && (
                      <div className="mt-1.5 text-xs text-clinical-muted">
                        {p.encounter_count} previous record{p.encounter_count !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-clinical-muted transition-colors group-hover:bg-clinical-primary/10 group-hover:text-clinical-primary" aria-hidden>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
