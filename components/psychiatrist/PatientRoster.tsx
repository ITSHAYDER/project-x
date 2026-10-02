"use client";

import { useMemo, useState } from "react";

type PatientRow = {
  id: string;
  name: string;
  acceptedAt: string;
  latestCheckIn?: {
    checkin_date: string;
    mood: number | null;
    energy: number | null;
    wants_to_discuss: boolean;
  };
};

type PatientFilter = "all" | "requests" | "no-check-in";

const FILTERS: { value: PatientFilter; label: string }[] = [
  { value: "all", label: "All patients" },
  { value: "requests", label: "Asked to discuss" },
  { value: "no-check-in", label: "No check-in" },
];

export function PatientRoster({ patients }: { patients: PatientRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PatientFilter>("all");

  const counts = useMemo(
    () => ({
      all: patients.length,
      requests: patients.filter((patient) => patient.latestCheckIn?.wants_to_discuss).length,
      "no-check-in": patients.filter((patient) => !patient.latestCheckIn).length,
    }),
    [patients],
  );

  const visiblePatients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return patients.filter((patient) => {
      const matchesQuery = patient.name.toLocaleLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "requests" && patient.latestCheckIn?.wants_to_discuss) ||
        (filter === "no-check-in" && !patient.latestCheckIn);
      return matchesQuery && matchesFilter;
    });
  }, [filter, patients, query]);

  return (
    <section aria-label="Patient care list" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-hairline bg-white px-3">
          <span aria-hidden="true" className="text-ink/40">Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Patient name"
            aria-label="Search patients by name"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-ink/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded px-1.5 py-1 text-xs text-ink/55 hover:bg-pine-soft hover:text-ink"
              aria-label="Clear patient search"
            >
              Clear
            </button>
          )}
        </label>
        <div className="flex gap-1 overflow-x-auto" aria-label="Filter patient list">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                filter === option.value
                  ? "bg-pine-dark text-white"
                  : "text-ink/60 hover:bg-pine-soft hover:text-ink"
              }`}
            >
              {option.label}
              <span className="ml-1.5 tabular-nums opacity-75">{counts[option.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-ink/50" aria-live="polite">
        Showing {visiblePatients.length} of {patients.length} {patients.length === 1 ? "patient" : "patients"}
      </p>

      {visiblePatients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline px-5 py-10 text-center">
          <p className="text-sm font-medium text-ink">No patients match this view</p>
          <p className="mt-1 text-xs text-ink/55">Try another filter or clear the search.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {visiblePatients.map((patient) => (
            <a
              key={patient.id}
              href={`/psychiatrist/patients/${patient.id}`}
              className="soft-panel flex flex-col gap-3 p-4 transition-colors duration-200 ease-out hover:border-pine/30 hover:bg-pine-soft/20 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-medium text-ink">{patient.name}</span>
                <span className="mt-1 block text-xs text-ink/50">
                  Connected {new Date(patient.acceptedAt).toLocaleDateString()}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:justify-end sm:text-right">
                {patient.latestCheckIn ? (
                  <>
                    <span>
                      <span className="block font-medium text-ink">
                        Mood {patient.latestCheckIn.mood ?? "—"}/5
                        <span className="font-normal text-ink/50"> · Energy {patient.latestCheckIn.energy ?? "—"}/5</span>
                      </span>
                      <span className="mt-1 block text-xs text-ink/50">
                        Check-in {new Date(patient.latestCheckIn.checkin_date).toLocaleDateString()}
                      </span>
                    </span>
                    {patient.latestCheckIn.wants_to_discuss && (
                      <span className="rounded-md border border-clay/25 bg-clay-soft px-2 py-1 text-xs font-medium text-clay">
                        Asked to discuss
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-ink/50">No check-in yet</span>
                )}
                <span aria-hidden="true" className="text-lg text-clay">→</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}