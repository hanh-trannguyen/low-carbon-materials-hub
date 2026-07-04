"use client";

import { useEffect, useState } from "react";
import type { Epd } from "@/shared/epd/schema";
import { Comparison } from "./comparison";

type EpdsResponse = {
  epds: Epd[];
};

export function EpdHub() {
  const [epds, setEpds] = useState<Epd[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function loadEpds() {
      try {
        const response = await fetch("/api/epds", {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Failed to load EPDs: ${response.status}`);
        }

        const data = (await response.json()) as EpdsResponse;
        setEpds(data.epds);
        setStatus("ready");
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setStatus("error");
        }
      }
    }

    void loadEpds();

    return () => controller.abort();
  }, []);

  const reportedValues = epds.reduce(
    (count, epd) => count + epd.lifeCycleGwp.filter((item) => item.status === "reported").length,
    0
  );
  const productsWithFlags = epds.filter((epd) => epd.dataQualityFlags.length > 0).length;

  return (
    <div className="page">
      <header className="heading">
        <div>
          <h1>Low Carbon Materials Hub</h1>
          <p>
            Compare concrete EPDs stage by stage with missing data kept visible. Carbon figures link back to
            the source PDF page and quoted evidence used during extraction.
          </p>
        </div>
        <div className="summary">
          <div className="metric">
            <strong>{epds.length}</strong>
            <span>EPDs</span>
          </div>
          <div className="metric">
            <strong>{reportedValues}</strong>
            <span>reported carbon values</span>
          </div>
          <div className="metric">
            <strong>{productsWithFlags}</strong>
            <span>with data flags</span>
          </div>
        </div>
      </header>

      {status === "loading" ? <div className="stateMessage">Loading EPD data...</div> : null}
      {status === "error" ? <div className="stateMessage errorMessage">Could not load EPD data.</div> : null}
      {status === "ready" ? <Comparison epds={epds} /> : null}
    </div>
  );
}
