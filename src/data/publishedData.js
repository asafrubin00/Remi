import { normalizeDirectorNameKey } from "./governanceData.js";

const SNAPSHOT_BASE = "https://raw.githubusercontent.com/asafrubin00/Remi/main/data/";

export async function loadPublishedData(index, signal) {
  const response = await fetch(`${SNAPSHOT_BASE}published-${index}.json`, { signal });
  if (!response.ok) throw new Error(`Published ${index} data unavailable (${response.status})`);
  const snapshot = await response.json();
  if (snapshot.version !== 1 || !Array.isArray(snapshot.constituents)) throw new Error("Unknown snapshot format");
  return snapshot;
}

export function mergeCompanyRecords(previous, incoming) {
  if (!previous) return incoming;
  if (!incoming?.directors?.length) return previous;

  const directors = new Map(previous.directors.map((person) => [personKey(person), person]));
  for (const person of incoming.directors) {
    const key = personKey(person);
    const existing = directors.get(key);
    const years = { ...existing?.years, ...person.years };
    for (const [year, record] of Object.entries(existing?.years || {})) {
      if (record.source === "manual" && record.sourceUrl) years[year] = record;
    }
    const newer = latestYear(person) >= latestYear(existing);
    directors.set(key, { ...(newer ? person : existing), id: existing?.id || `${incoming.id}:${key}`, years });
  }

  return { ...previous, ...incoming, directors: [...directors.values()] };
}

export function applyPublishedData(seed, snapshots) {
  const companies = new Map(seed.map((item) => [item.id, item]));
  for (const snapshot of snapshots) {
    const memberIds = new Set(snapshot.constituents.map((item) => item.id));
    for (const company of companies.values()) {
      if (company.index === snapshot.index && !memberIds.has(company.id)) {
        if (!company.directors.length) companies.delete(company.id);
        else companies.set(company.id, { ...company, archived: true });
      }
    }
    for (const item of snapshot.constituents) {
      const previous = companies.get(item.id);
      const source = snapshot.records[item.id];
      const merged = source ? mergeCompanyRecords(previous, source) : previous;
      companies.set(item.id, {
        directors: [], ...merged, ...item, archived: false,
        company: merged?.company || item.company,
        refresh: snapshot.checks[item.id] || null
      });
    }
  }
  return [...companies.values()];
}

function personKey(person) {
  return `${person.type}:${normalizeDirectorNameKey(person.name)}`;
}

function latestYear(person) {
  return Math.max(...Object.keys(person?.years || {}).map(Number));
}
