# Remi

**Remuneration Intelligence. Executive and NED pay, for FTSE 350 and S&P 500.**

💰 [View dashboard →](https://remi-ashen.vercel.app)

Executive pay is one of the most scrutinised — and least navigable — corners of corporate governance. Annual reports bury it in footnotes, proxy statements use inconsistent formats, and comparing pay across companies or indices means manually cross-referencing a dozen PDFs. Remi fixes that.

---

## What It Does

Remi aggregates, normalises, and presents publicly available remuneration data for executive and non-executive directors at **FTSE 350** and **S&P 500** companies — searchable, comparable, and ranked.

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

Every record carries a **Live / Verified / Mock** badge so users always know the provenance of the data they're looking at. A contextual AI analysis panel (Claude Haiku, streaming) sits alongside the charts, generating commentary specific to whatever view is on screen.

---

## Data Sources

- **UK:** Companies House filings, annual report PDF parsing
- **US:** SEC EDGAR proxy filings (DEF 14A) — live scraping
- **Vote outcomes:** AGM disclosures and regulatory announcements

Currency is normalised at display time — FTSE companies in GBP, S&P 500 in USD — with cross-index comparisons converted at a consistent, visible FX rate.

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
