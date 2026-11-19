import { ArrowUpRight, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

export function indexLabel(index) {
  return { SP500: "S&P 500", FTSE100: "FTSE 100", FTSE250: "FTSE 250", FTSE350: "FTSE 350" }[index] || index;
}

export default function ResearchSearch({ dataset, directors, onSelect, placeholder = "Company, ticker, or director" }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    const companies = dataset.flatMap((company) => {
      const ticker = company.ticker?.toLowerCase();
      const name = company.company.toLowerCase();
      if (ticker !== term && !name.includes(term) && !ticker?.startsWith(term)) return [];
      const score = ticker === term || name === term ? 0 : name.startsWith(term) ? 1 : 3;
      return [{ key: company.id, label: company.company, meta: company.ticker || indexLabel(company.index), score, companyId: company.id }];
    });
    const people = directors.flatMap((person) => {
      const name = person.name.toLowerCase();
      if (!name.includes(term)) return [];
      return [{ key: person.id, label: person.name, meta: person.company, score: name === term ? 0 : name.startsWith(term) ? 2 : 4, companyId: person.companyId, directorId: person.id }];
    });
    return [...companies, ...people].sort((a, b) => a.score - b.score || a.label.localeCompare(b.label)).slice(0, 7);
  }, [dataset, directors, query]);

  const expanded = focused && query.trim().length >= 2;
  const select = (item) => {
    setQuery("");
    setFocused(false);
    setHighlighted(-1);
    onSelect(item);
  };

  return (
    <form className="research-search" role="search" onSubmit={(event) => {
      event.preventDefault();
      const result = results[highlighted] || results[0];
      if (result) select(result);
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}>
      <Search size={19} aria-hidden="true" />
      <input
        aria-label="Search companies and directors"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? id : undefined}
        aria-activedescendant={expanded && highlighted >= 0 ? `${id}-${highlighted}` : undefined}
        placeholder={placeholder}
        value={query}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setFocused(true);
          setHighlighted(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setFocused(false);
          if (!results.length) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setFocused(true);
            setHighlighted((current) => event.key === "ArrowDown"
              ? (current + 1) % results.length
              : (current <= 0 ? results.length - 1 : current - 1));
          }
        }}
      />
      {query ? <button className="research-search-clear" type="button" aria-label="Clear search" onClick={() => {
        setQuery("");
        setHighlighted(-1);
      }}><X size={16} /></button> : null}
      {expanded ? (
        <div className="research-search-list" id={id} role="listbox" aria-label="Search matches">
          {results.length ? results.map((item, index) => (
            <button key={item.key} id={`${id}-${index}`} role="option" type="button" tabIndex={-1}
              aria-selected={highlighted === index} onPointerDown={(event) => event.preventDefault()} onClick={() => select(item)}>
              <span>{item.label}</span><small>{item.meta}</small><ArrowUpRight size={14} aria-hidden="true" />
            </button>
          )) : <p role="status">No companies or directors found.</p>}
        </div>
      ) : null}
    </form>
  );
}
