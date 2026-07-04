"use client";

import { useId, useMemo, useRef, useState } from "react";

function toggleFilterValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function SearchableMultiSelect({
  label,
  options,
  selected,
  onChange,
  allLabel
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
  }, [options, query]);
  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  return (
    <div
      className="filter searchableSelect"
      ref={wrapperRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="selectTrigger"
        id={id}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{summary}</span>
        <span className="selectCaret" aria-hidden="true" />
      </button>
      {open ? (
        <div className="selectPopover">
          <input
            aria-label={`Search ${label.toLowerCase()}`}
            autoComplete="off"
            placeholder="Search..."
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="selectActions">
            <button type="button" onClick={() => onChange([])} disabled={selected.length === 0}>
              All
            </button>
          </div>
          <div className="selectOptions" role="listbox" aria-multiselectable="true">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const checked = selected.includes(option);

                return (
                  <div
                    aria-selected={checked}
                    className="selectOption"
                    key={option}
                    role="option"
                    tabIndex={0}
                    onClick={() => onChange(toggleFilterValue(selected, option))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onChange(toggleFilterValue(selected, option));
                      }
                    }}
                  >
                    <input checked={checked} readOnly tabIndex={-1} type="checkbox" />
                    <span>{option}</span>
                  </div>
                );
              })
            ) : (
              <p className="emptyOptions">No matches</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
