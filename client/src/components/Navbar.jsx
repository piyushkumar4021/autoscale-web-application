const links = [
  ["home", "Home"],
  ["status", "System Status"],
  ["performance", "Performance Lab"],
  ["about", "About"],
];

export default function Navbar({ page, setPage }) {
  return (
    <header className="nav-wrap">
      <nav className="nav container">
        <button className="brand" onClick={() => setPage("home")}>
          <span className="brand-mark">↗</span> AutoScale
        </button>
        <div className="nav-links">
          {links.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={page === key ? "active" : ""}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
