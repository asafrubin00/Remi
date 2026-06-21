const GOVERNANCE_YEAR = 2024;
const GOVERNANCE_LAST_UPDATED = "2026-06-08T00:00:00.000Z";

export const ftseSayOnPayPct = {
  bp: 71.3,
  shell: 82.1,
  hsbc: 78.4,
  barclays: 85.2,
  "lloyds-banking-group": 92.7,
  tesco: 79.4,
  unilever: 95.1,
  gsk: 88.6,
  astrazeneca: 91.2,
  "rio-tinto": 76.8,
  vodafone: 83.4,
  "bt-group": 88.9,
  "rolls-royce": 94.3,
  "national-grid": 89.7,
  "marks-spencer": 87.5
};

const nonExecutiveFees = {
  bp: [{ name: "Helge Lund", role: "Chair", fee: 750000, currency: "GBP" }],
  shell: [{ name: "Sir Andrew Mackenzie", role: "Chair", fee: 850000, currency: "GBP" }],
  hsbc: [{ name: "Mark Tucker", role: "Chair", fee: 1500000, currency: "GBP" }],
  barclays: [{ name: "Nigel Higgins", role: "Chair", fee: 850000, currency: "GBP" }],
  microsoft: [{ name: "John W. Thompson", role: "Lead Independent Director", fee: 350000, currency: "USD" }],
  apple: [{ name: "Arthur Levinson", role: "Chair", fee: 400000, currency: "USD" }],
  jpmorgan: [{ name: "Stephen Burke", role: "Lead Independent Director", fee: 425000, currency: "USD" }]
};

export function enrichGovernanceData(company) {
  if (!company?.id) return company;

  const sayOnPayPct = ftseSayOnPayPct[company.id] ?? null;
  const directors = (company.directors || []).map((director) => sanitizeDirectorCompensation(applySayOnPay(director, sayOnPayPct)));
  const existingIds = new Set(directors.map((director) => director.id));

  for (const feeRecord of nonExecutiveFees[company.id] || []) {
    const director = buildNonExecutiveDirector(company, feeRecord, sayOnPayPct);
    if (!existingIds.has(director.id)) directors.push(director);
  }

  return {
    ...company,
    directors,
    sayOnPayPct: sayOnPayPct ?? company.sayOnPayPct ?? null
  };
}

function sanitizeDirectorCompensation(director) {
  const identity = normalizeDirectorIdentity(director);
  return {
    ...director,
    name: identity.name,
    role: identity.role,
    years: Object.fromEntries(
      Object.entries(director.years || {}).map(([year, record]) => [
        year,
        {
          ...record,
          baseSalary: normalizeCompensationValue(record.baseSalary),
          annualBonus: normalizeCompensationValue(record.annualBonus),
          ltip: normalizeCompensationValue(record.ltip),
          pensionBenefits: normalizeCompensationValue(record.pensionBenefits),
          totalCompensation: normalizeCompensationValue(record.totalCompensation)
        }
      ]),
    )
  };
}

function normalizeDirectorIdentity(director) {
  let name = String(director.name || "").replace(/\s+/g, " ").trim();
  let role = String(director.role || "").replace(/\s+/g, " ").trim();

  if (/\bFormer$/i.test(name)) {
    name = name.replace(/\s+\bFormer$/i, "").trim();
    if (role && !/^Former\b/i.test(role)) role = `Former ${role}`;
  }

  if (/\bTechnoking of Tesla and$/i.test(name)) {
    name = name.replace(/\s+\bTechnoking of Tesla and$/i, "").trim();
    role = `Technoking of Tesla and ${role}`.trim();
  }

  if (/\d+Co-$/i.test(name)) {
    name = name.replace(/\d+Co-$/i, "").trim();
    if (/^CEO\b/i.test(role)) role = `Co-${role}`;
  }

  name = name.replace(/\d+$/g, "").trim();
  role = role.replace(/\band(?=Chief)/g, "and ").replace(/\s+/g, " ").trim();

  return { name, role };
}

function normalizeCompensationValue(value) {
  if (value == null || !Number.isFinite(Number(value))) return value;
  if (value > 1000000000 && value % 1000000 === 0) return Math.round(value / 1000000);
  if (value > 1000000000) return null;
  return value;
}

function applySayOnPay(director, sayOnPayPct) {
  if (sayOnPayPct == null) return director;
  return {
    ...director,
    sayOnPayPct,
    years: Object.fromEntries(
      Object.entries(director.years || {}).map(([year, record]) => [
        year,
        {
          ...record,
          sayOnPayPct
        }
      ]),
    )
  };
}

function buildNonExecutiveDirector(company, feeRecord, sayOnPayPct) {
  const id = `${company.id}-${slugify(feeRecord.name)}`;
  return {
    id,
    name: feeRecord.name,
    role: feeRecord.role,
    type: "non-executive",
    source: "manual",
    sourceUrl: null,
    payRatio: null,
    sayOnPayPct,
    lastUpdated: GOVERNANCE_LAST_UPDATED,
    years: {
      [GOVERNANCE_YEAR]: {
        nedFees: feeRecord.fee,
        totalCompensation: feeRecord.fee,
        baseSalary: null,
        annualBonus: null,
        ltip: null,
        pensionBenefits: null,
        payRatio: null,
        sayOnPayPct,
        source: "manual",
        sourceUrl: null,
        lastUpdated: GOVERNANCE_LAST_UPDATED
      }
    }
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
