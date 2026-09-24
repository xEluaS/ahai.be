-- What visitors asked in "Klikt het?": no name, no IP address.
CREATE TABLE IF NOT EXISTS antwoorden (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tijd TEXT NOT NULL DEFAULT (datetime('now')),
  tekst TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER,
  dienst TEXT,
  factoren TEXT
);
CREATE INDEX IF NOT EXISTS antwoorden_tijd ON antwoorden (tijd);
