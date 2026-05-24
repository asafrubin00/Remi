export function Panel({ children, className = "" }) {
  return <section className={`remi-panel ${className}`}>{children}</section>;
}

export function SectionHeader({ children, className = "" }) {
  return <h2 className={`remi-kicker ${className}`}>{children}</h2>;
}

export function DataValue({ children, className = "" }) {
  return <span className={`remi-data ${className}`}>{children}</span>;
}

export function TabButton({ active, children, className = "", ...props }) {
  return (
    <button className={`remi-tab ${active ? "remi-tab-active" : ""} ${className}`} {...props}>
      {children}
    </button>
  );
}
