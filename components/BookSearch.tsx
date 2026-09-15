"use client";

import { useState, useTransition } from "react";
import { searchBooks, addToShelf } from "@/app/actions/books";
import type { BookResult } from "@/lib/openlibrary";
import { Cover } from "./BookCard";
import Icon from "./Icon";

export default function BookSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    if (q.trim().length < 2) return;
    start(async () => { setResults(await searchBooks(q)); setSearched(true); });
  }

  return (
    <div>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <label className="field grow">
          <Icon name="search" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Search by title or author"
            aria-label="Search for a book"
          />
        </label>
        <button className="btn btn--primary" onClick={run} disabled={pending || q.trim().length < 2}>
          {pending ? "Searching" : "Search"}
        </button>
      </div>

      {searched && results.length === 0 && !pending && (
        <p className="meta mt-md">Nothing matched. Try the author&apos;s name, or a shorter title.</p>
      )}

      {results.length > 0 && (
        <ul className="feed mt-md">
          {results.map((b) => (
            <li key={b.sourceId} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ flexWrap: "nowrap", gap: 12 }}>
                <Cover url={b.coverUrl} title={b.title} w={40} h={60} />
                <div className="grow">
                  <p className="book-title truncate">{b.title}</p>
                  <p className="meta truncate">
                    {b.author ?? "Unknown author"}{b.totalPages ? ` · ${b.totalPages} pages` : ""}
                  </p>
                </div>
                <button
                  className="btn"
                  disabled={pending || added.has(b.sourceId)}
                  onClick={() => start(async () => {
                    const res = await addToShelf(b);
                    if (!res.error) setAdded((p) => new Set(p).add(b.sourceId));
                  })}
                >
                  {added.has(b.sourceId) ? "On shelf" : "Add"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
