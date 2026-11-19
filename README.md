# Remi

**Remuneration Intelligence. Executive and non-executive pay for the FTSE 100 and S&P 500.**

💰 [View dashboard →](https://remi-ashen.vercel.app)

Executive pay is one of the most scrutinised — and least navigable — corners of corporate governance. Annual reports bury it in footnotes, proxy statements use inconsistent formats, and comparing pay across companies or indices means manually cross-referencing a dozen PDFs. Remi fixes that.

---

## What It Does

Remi aggregates publicly disclosed remuneration for executive and non-executive directors at **FTSE 100** and **S&P 500** companies.

**Three core views:**
- **Find** — look up any director's full pay breakdown
- **Compare** — search-and-add interface to compare up to 6 directors or companies side by side, with log-scale charting
- **League Tables** — ranked views across companies and pay components

**Pay components tracked:**
- Base salary
- Annual bonus / STI
- Long-term incentives (LTIP/PSP)
- Pension & benefits
- NED / Chair fees
- Say-on-pay vote outcome
- Total compensation

Profiles show the reporting year, record update date, and original filing where available. Manually sourced figures and historical seeds are distinguished from automated filing extractions.

---

## Data Sources

- **UK:** Companies House filings, annual report PDF parsing
- **US:** SEC EDGAR proxy filings (DEF 14A), with vote results where available
- **Vote outcomes:** AGM disclosures and regulatory announcements

Amounts are displayed without cross-currency conversion.

## Refresh and Coverage

The [Refresh remuneration filings workflow](https://github.com/asafrubin00/Remi/actions/workflows/refresh-filings.yml) checks both indices daily at 03:17 UTC. It can also be dispatched from GitHub Actions. It checks index membership, reads public filings through Remi's production scraper endpoints, and publishes snapshots to `data/published-*.json`. The app reads those snapshots on startup without a redeploy. This workflow replaces the old monthly Vercel cron and does not need KV.

Each snapshot lists companies checked, records published, and failures by company. A failed scrape does not overwrite a previously published record. UK report formats still limit automated coverage; older records are retained with their original reporting year and source. A successful check date is not a claim that new compensation was disclosed on that date.

---

## Why I Built It

Remuneration sits at the centre of the governance and stewardship conversation — it's the single issue most likely to trigger shareholder dissent, proxy adviser flags, and AGM controversy. ISS and Glass Lewis both run dedicated remuneration research practices for exactly this reason. Remi was built to demonstrate that same domain fluency in an interactive, public-facing tool — and to put real, verifiable pay data in front of anyone who wants to look at it.

---

## Tech Stack

![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

React, Tailwind CSS, deployed on Vercel with serverless functions handling live scraping and AI analysis. Built with OpenAI Codex.

---

## Status

✅ Live — Find, Compare, and League Tables fully functional; live S&P 500 scraping via SEC EDGAR; partial FTSE live coverage with verified manual data for blocked companies  
🔜 In development — expanding FTSE 250 coverage, broader NED dataset, additional league table filters

---

## Running Locally

```bash
git clone https://github.com/asafrubin00/Remi.git
cd Remi
npm install
npm run dev
```

Run the data tests with `npm test`.
