const namePart = String.raw`[\p{Lu}][\p{L}.'’-]*(?:\s+[\p{Lu}][\p{L}.'’-]*){1,6}`;
const names = new RegExp(`^${namePart}$`, "u");
const money = /^(?:\d{1,3}(?:,\d{3})*|[—–-])$/;

export function isDirectorName(name) {
  const normalized = name.replace(/\s+(?:de|del|da|di|van|von|ten|ter)\s+/giu, " ");
  return names.test(normalized) && !/\b(?:Following?|Followin|Executive|Director|Salary|Total|Name|Board|Senior|Report|Chief|Officer|Fees|Financial|President|Image|Chairman|Committee|Former|Remuneration|Management|SVP|CFO|CEO)\b/i.test(normalized);
}

export async function renderSpacedPdfPage(page) {
  const { items } = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
  let text = "";
  let previous;
  for (const item of items) {
    const [,,,, x, y] = item.transform;
    if (previous) text += Math.abs(previous.y - y) > .15 ? "\n" : x - previous.right > 1.5 ? " " : "";
    text += item.str;
    previous = { y, right: x + item.width };
  }
  return text;
}

export function parseIssuerTables(text, companyId, fiscalYear) {
  if (!fiscalYear || !["bp", "shell", "hsbc"].includes(companyId)) return null;
  const lines = text.split(/\r?\n/).map((line) => line.trim().replace(/\s+/g, " ")).filter(Boolean);

  const directors = companyId === "hsbc"
    ? parseHsbcExecutive(lines, fiscalYear)
    : parseColumnExecutives(lines, companyId, fiscalYear);
  const nonExecutives = companyId === "bp" ? [] : parseFeeTable(lines, companyId, fiscalYear);
  return { directors, nonExecutives };
}

function parseColumnExecutives(lines, issuer, year) {
  const isBp = issuer === "bp";
  const heading = isBp ? /single figure table\s*[-–—]\s*executive directors/i : /^Single figure of total remuneration for Executive Directors \(audited\)/i;
  for (const [index, line] of lines.entries()) {
    if (!heading.test(line)) continue;
    const section = lines.slice(index + 1, index + 32);
    const salary = findRow(section, /^(?:Salary|Salaries)\b/i);
    if (salary < 2 || salary > 12 || !section.slice(0, salary).some((item) => /£\s*(?:thousand|000|'000|’000)/i.test(item))) continue;
    const years = (section[salary - 1].match(/20\d{2}/g) || []).map(Number);
    if (years.length < 2 || years.length > 8 || !years.includes(year)) continue;
    const mappedNames = section.slice(0, salary - 1)
      .filter((item) => !/£\s*(?:thousand|000|'000|’000)/i.test(item))
      .flatMap((item) => item.match(/(?:Sir\s+|Dame\s+)?\p{Lu}[\p{Ll}.'’-]+\s+\p{Lu}[\p{Ll}.'’-]+/gu) || [])
      .filter(isDirectorName);
    if (mappedNames.length !== years.length / 2 || new Set(mappedNames).size !== mappedNames.length) continue;
    const rows = [
      /^(?:Salary|Salaries)\b/i, /^(?:Taxable )?benefits\b/i, /^(?:Cash allowance in lieu of pension|Pension)\b/i,
      /^Annual bonus\b/i, /^(?:Share award|Performance shares)\b/i, /^Total remuneration\b/i
    ].map((pattern) => section.map((item) => readRow(item, pattern, years.length)).find(Boolean));
    if (rows.some((row) => !row)) continue;
    return mappedNames.flatMap((name, personIndex) => {
      const records = {};
      for (const i of [personIndex * 2, personIndex * 2 + 1]) {
        const [baseSalary, benefits, pension, annualBonus, ltip, totalCompensation] = rows.map((row) => row[i]);
        const pensionBenefits = benefits + pension;
        if (Math.abs(baseSalary + pensionBenefits + annualBonus + ltip - totalCompensation) <= 2000) {
          records[years[i]] = { baseSalary, pensionBenefits, annualBonus, ltip, totalCompensation };
        }
      }
      const role = personIndex === 0 ? "Chief Executive Officer" : personIndex === 1 ? "Chief Financial Officer" : "Executive Director";
      return Object.keys(records).length ? [{ name, role, records }] : [];
    });
  }
  return [];
}

function parseHsbcExecutive(lines, year) {
  const index = lines.findIndex((line) => /^The following table shows the single total figure of remuneration of each executive Director/i.test(line));
  if (index === -1) return [];
  const section = lines.slice(index + 1, index + 65);
  if (!section.some((line) => /^\(£000\)/.test(line))) return [];
  const people = new Map();
  let name;
  for (const line of section) {
    if (isDirectorName(line)) name = line;
    if (!name || !/^20\d{2} /.test(line)) continue;
    const [fiscalYear, ...tokens] = line.split(" ");
    if (Number(fiscalYear) > year || tokens.length !== 11 || !tokens.every((token) => money.test(token))) continue;
    const [baseSalary, , taxable, nonTaxable, pension, fixed, annualBonus, , ltip, variable, totalCompensation] = tokens.map(thousands);
    if (Math.abs(fixed + variable - totalCompensation) > 1000) continue;
    if (!people.has(name)) people.set(name, { name, role: people.size ? "Chief Financial Officer" : "Chief Executive Officer", records: {} });
    people.get(name).records[fiscalYear] = { baseSalary, pensionBenefits: taxable + nonTaxable + pension, annualBonus, ltip, totalCompensation };
  }
  return [...people.values()];
}

function parseFeeTable(lines, issuer, year) {
  const heading = issuer === "shell"
    ? /^Single figure of total remuneration for Non-executive Directors \(audited\)/i
    : /^The following table shows the total fees and benefits of non-executive Directors/i;
  const start = findRow(lines, heading);
  if (start === -1) return [];
  const section = lines.slice(start + 1, start + 52);
  const header = section.findIndex((line) => (line.match(/20\d{2}/g) || []).length === 6);
  if (header < 0 || header > 12 || !section.slice(0, header + 1).some((line) => /£\s*(?:thousand|000)/i.test(line))) return [];
  const years = section[header].match(/20\d{2}/g).map(Number);
  if (years[0] !== year || years[2] !== year || years[4] !== year || years[1] !== years[3] || years[3] !== years[5]) return [];
  const records = [];
  let priorName;
  for (const line of section.slice(header + 1)) {
    if (/^(?:Total|\[A\]|1 Fees)\b/i.test(line)) break;
    const tokens = line.replace(/\[[A-Z]\]/g, "").trim().split(/\s+/);
    const tail = tokens.slice(-6);
    if (tail.length !== 6 || !tail.every((token) => money.test(token))) {
      if (isDirectorName(line)) priorName = line;
      continue;
    }
    const name = tokens.slice(0, -6).join(" ") || priorName;
    priorName = null;
    if (!name || !isDirectorName(name)) continue;
    const values = tail.map(thousands);
    const observed = {};
    for (const i of [0, 1]) {
      const [nedFees, pensionBenefits, totalCompensation] = [values[i], values[i + 2], values[i + 4]];
      if (Math.abs(nedFees + pensionBenefits - totalCompensation) <= 1000) {
        observed[years[i]] = { nedFees, pensionBenefits, totalCompensation };
      }
    }
    const role = /Mackenzie|Tucker|Nelson/i.test(name) ? "Chair" : "Non-executive director";
    if (Object.keys(observed).length) records.push({ name, role, records: observed });
  }
  return records;
}

function findRow(lines, pattern) {
  return lines.findIndex((line) => pattern.test(line));
}

function readRow(line, pattern, count) {
  if (!pattern.test(line)) return null;
  const tokens = line.replace(pattern, "").replace(/\[[A-Z]\]/g, "").trim().split(/\s+/);
  return tokens.length === count && tokens.every((token) => money.test(token)) ? tokens.map(thousands) : null;
}

function thousands(value) {
  return (Number(value.replace(/,/g, "")) || 0) * 1000;
}
