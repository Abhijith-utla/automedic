import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { getPatientProfile, type PatientProfile } from "@/api/client";
import { AlertsCard, EncountersByMonthChart } from "@/components/patient";
import {
  DEFAULT_MOCK_VITALS,
  MOCK_HEART_RATE_TREND,
  HEART_RATE_NORMAL_RANGE,
} from "@/utils/mockPatientVitals";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceArea,
} from "recharts";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    setPhotoError(false);
    getPatientProfile(patientId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  const monthCounts = useMemo(() => {
    if (!profile?.timeline?.length) return [];
    const byMonth: Record<string, number> = {};
    for (const e of profile.timeline) {
      const key = e.month_key || e.date.slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }, [profile?.timeline]);

  const hrvPreview = useMemo(() => {
    if (!patientId) return null;
    try {
      const raw = sessionStorage.getItem(`patient_hrv_preview:${patientId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        bpm?: number | null;
        spo2?: number | null;
        rmssd?: number | null;
        sdnn?: number | null;
      };
      return parsed;
    } catch {
      return null;
    }
  }, [patientId]);

  if (!patientId) return null;
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinical-bg">
        <p className="text-clinical-muted">Loading…</p>
      </div>
    );
  if (!profile)
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinical-bg">
        <p className="text-clinical-muted">Patient not found.</p>
      </div>
    );

  const { patient, timeline, alerts } = profile;
  const v = {
    ...DEFAULT_MOCK_VITALS,
    heartRate: hrvPreview?.bpm ?? DEFAULT_MOCK_VITALS.heartRate,
  };
  const showPhoto = patient.photo_url && !photoError;

  return (
    <div className="min-h-screen flex flex-col w-full bg-clinical-bg">
      {/* Top bar */}
      <header className="shrink-0 border-b border-clinical-border bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between max-w-[1200px] mx-auto">
          <Link
            to="/patients"
            className="text-sm text-clinical-muted hover:text-clinical-primary transition-colors"
          >
            ← Patients
          </Link>
          <Link
            to={`/patients/${patientId}/encounter`}
            className="rounded-lg bg-clinical-primary text-white px-4 py-2.5 text-sm font-medium hover:bg-clinical-primaryHover transition-colors shadow-sm"
          >
            Start encounter
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-8">
        <div className="w-full max-w-[1200px] mx-auto space-y-8">
          {/* Patient identity card */}
          <section className="rounded-2xl border border-clinical-border bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-clinical-primary/5 text-2xl font-semibold text-clinical-primary ring-1 ring-clinical-border/50">
                {showPhoto ? (
                  <img
                    src={patient.photo_url}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <span className="select-none">{getInitials(patient.name)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                  {patient.name}
                </h1>
                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {patient.date_of_birth && (
                    <>
                      <dt className="text-clinical-muted">Date of birth</dt>
                      <dd className="text-gray-800">{patient.date_of_birth}</dd>
                    </>
                  )}
                  {patient.mrn && (
                    <>
                      <dt className="text-clinical-muted">MRN</dt>
                      <dd className="text-gray-800">{patient.mrn}</dd>
                    </>
                  )}
                  {patient.email && (
                    <>
                      <dt className="text-clinical-muted">Email</dt>
                      <dd className="text-gray-800">{patient.email}</dd>
                    </>
                  )}
                  {patient.phone && (
                    <>
                      <dt className="text-clinical-muted">Phone</dt>
                      <dd className="text-gray-800">{patient.phone}</dd>
                    </>
                  )}
                </dl>
                {patient.notes && (
                  <div className="mt-4 rounded-xl bg-clinical-bg/80 border border-clinical-border/60 px-4 py-3">
                    <p className="text-xs font-medium text-clinical-muted uppercase tracking-wider mb-1">Clinical notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Vitals */}
          <section>
            <h2 className="text-xs font-semibold text-clinical-muted uppercase tracking-wider mb-3">
              Latest vitals
            </h2>
            <div className="flex flex-wrap gap-3">
              <VitalPill label="Heart rate" value={`${v.heartRate} bpm`} />
              <VitalPill
                label="Blood pressure"
                value={`${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}`}
              />
              <VitalPill label="Temp" value={`${v.temperatureF} °F`} />
              <VitalPill label="Glucose" value={v.glucoseLevel} />
              {hrvPreview?.spo2 != null && <VitalPill label="SpO₂" value={`${hrvPreview.spo2}%`} />}
              {hrvPreview?.rmssd != null && <VitalPill label="RMSSD" value={`${hrvPreview.rmssd}`} />}
              {hrvPreview?.sdnn != null && <VitalPill label="SDNN" value={`${hrvPreview.sdnn}`} />}
            </div>
          </section>

          {/* Heart rate trend */}
          <section className="rounded-2xl border border-clinical-border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Heart rate trend</h2>
                <p className="text-xs text-clinical-muted mt-0.5">
                  Resting heart rate over the last 7 days · normal range 60–100 bpm
                </p>
              </div>
              <span className="text-2xl font-semibold text-clinical-primary tabular-nums">
                {v.heartRate}
                <span className="text-sm font-normal text-clinical-muted ml-1">bpm now</span>
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={MOCK_HEART_RATE_TREND}
                  margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <ReferenceArea
                    y1={HEART_RATE_NORMAL_RANGE.min}
                    y2={HEART_RATE_NORMAL_RANGE.max}
                    fill="#b91c1c"
                    fillOpacity={0.06}
                  />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[50, 110]}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(n) => `${n}`}
                    width={28}
                  />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md text-sm">
                          <span className="text-clinical-muted">{payload[0].payload.dateLabel}</span>
                          <span className="font-semibold text-gray-900 ml-2">{payload[0].value} bpm</span>
                        </div>
                      ) : null
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="bpm"
                    stroke="#b91c1c"
                    strokeWidth={2}
                    dot={{ fill: "#b91c1c", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Alerts + Previous records */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <AlertsCard alerts={alerts} />
            </div>
            <div className="lg:col-span-2">
              <section className="rounded-2xl border border-clinical-border bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Previous records</h2>
                <p className="text-xs text-clinical-muted mt-0.5 mb-4">Past encounters and visits</p>
                {timeline.length === 0 ? (
                  <p className="text-sm text-clinical-muted">No records yet. Start an encounter to add one.</p>
                ) : (
                  <>
                    <EncountersByMonthChart monthCounts={monthCounts} className="mb-5" />
                    <ul className="divide-y divide-gray-100">
                      {timeline.map((e) => (
                        <li key={e.id} className="flex gap-4 py-3 first:pt-0 text-sm">
                          <span className="text-clinical-muted shrink-0 w-24 tabular-nums">{e.date}</span>
                          <span className="text-gray-800 flex-1">{e.summary}</span>
                          {e.type && (
                            <span className="text-clinical-muted shrink-0 text-xs capitalize">{e.type}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function VitalPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-clinical-border bg-white px-4 py-3 min-w-[120px] shadow-sm">
      <p className="text-[11px] font-medium text-clinical-muted uppercase tracking-wider">{label}</p>
      <p className="text-lg font-semibold text-gray-900 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
