"use client";

import type { SourceSelection } from "./comparison-types";

function pdfPageUrl(sourcePdf: string, page: number) {
  return `/api/epds/pdf/${encodeURIComponent(sourcePdf)}#page=${page}`;
}

function pdfUrl(sourcePdf: string) {
  return `/api/epds/pdf/${encodeURIComponent(sourcePdf)}`;
}

export function SourceDrawer({
  selection,
  onClose
}: {
  selection: NonNullable<SourceSelection>;
  onClose: () => void;
}) {
  return (
    <div className="drawerBackdrop" role="presentation" onClick={onClose}>
      <aside
        className="drawer"
        aria-label="Carbon value source"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawerHeader">
          <div>
            <h2>
              {selection.kind === "total_incomplete"
                ? selection.product
                : selection.kind === "row_status"
                  ? selection.product
                  : selection.kind === "product_pdf"
                    ? selection.product
                    : `${selection.product} | ${selection.module}`}
            </h2>
            {selection.kind === "reported" ? (
              <span className="meta">
                {selection.value} {selection.unit}
              </span>
            ) : selection.kind === "nd" ? (
              <span className="meta ndLabel">⚠️ {selection.statusLabel}</span>
            ) : selection.kind === "row_status" ? (
              <span className="meta">{selection.statusLabel}</span>
            ) : selection.kind === "product_pdf" ? (
              <span className="meta">{selection.sourcePdf}</span>
            ) : (
              <span className="meta ndLabel">⚠️ {selection.title}</span>
            )}
          </div>
          <button className="closeButton" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {selection.kind === "reported" ? (
          <>
            <div className="pdfPreview">
              <iframe
                src={pdfPageUrl(selection.sourcePdf, selection.page)}
                title={`${selection.sourcePdf} page ${selection.page}`}
              />
            </div>
            <a
              className="pdfLink"
              href={pdfPageUrl(selection.sourcePdf, selection.page)}
              rel="noreferrer"
              target="_blank"
            >
              Open PDF at page {selection.page}
            </a>
            <dl className="sourceDetails">
              <div>
                <dt>Indicator</dt>
                <dd>GWP-total</dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>
                  {selection.value} {selection.unit}
                </dd>
              </div>
              <div>
                <dt>Source file</dt>
                <dd>{selection.sourcePdf}</dd>
              </div>
              <div>
                <dt>Page</dt>
                <dd>{selection.page}</dd>
              </div>
              <div>
                <dt>Table</dt>
                <dd>{selection.table}</dd>
              </div>
              <div>
                <dt>Row</dt>
                <dd>{selection.row}</dd>
              </div>
            </dl>
          </>
        ) : null}

        {selection.kind === "product_pdf" ? (
          <>
            <div className="pdfPreview productPdfPreview">
              <iframe src={pdfUrl(selection.sourcePdf)} title={selection.sourcePdf} />
            </div>
            <a
              className="pdfLink"
              href={pdfUrl(selection.sourcePdf)}
              rel="noreferrer"
              target="_blank"
            >
              Open original PDF
            </a>
            <dl className="sourceDetails">
              <div>
                <dt>Source file</dt>
                <dd>{selection.sourcePdf}</dd>
              </div>
            </dl>
          </>
        ) : null}

        {selection.kind === "nd" ? (
          <>
            <div className="ndDrawerBody">
              <p>{selection.statusMeta}</p>
              <p className="ndExplain">
                A not-declared stage is <strong>never</strong> treated as zero. It is excluded
                from the Total GWP calculation to prevent understating this product&apos;s carbon
                footprint.
              </p>
            </div>
            {selection.page !== null ? (
              <>
                <div className="pdfPreview">
                  <iframe
                    src={pdfPageUrl(selection.sourcePdf, selection.page)}
                    title={`${selection.sourcePdf} page ${selection.page}`}
                  />
                </div>
                <a
                  className="pdfLink"
                  href={pdfPageUrl(selection.sourcePdf, selection.page)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open PDF at page {selection.page}
                </a>
              </>
            ) : null}
            <dl className="sourceDetails">
              <div>
                <dt>Value</dt>
                <dd>Not Declared (ND)</dd>
              </div>
              <div>
                <dt>Source file</dt>
                <dd>{selection.sourcePdf}</dd>
              </div>
              {selection.page !== null ? (
                <div>
                  <dt>Page</dt>
                  <dd>{selection.page}</dd>
                </div>
              ) : null}
            </dl>
            {selection.quote ? <div className="quote">{selection.quote}</div> : null}
          </>
        ) : null}

        {selection.kind === "total_incomplete" ? (
          <div className="ndDrawerBody">
            <dl className="sourceDetails">
              <div>
                <dt>Helper total</dt>
                <dd>
                  &gt; {selection.partialValue} {selection.unit}
                </dd>
              </div>
            </dl>
            <p className="ndExplain">
              We added the reported modules so you do not have to sum them manually. This is only
              a helper number, not the final total.
            </p>
            <p>
              It should not be used for comparison because the following{" "}
              {selection.missingModules.length === 1 ? "module is" : "modules are"} missing:
            </p>
            <ul className="missingList">
              {selection.missingModules.map((mod) => (
                <li key={mod}>
                  <strong>{mod}</strong>
                </li>
              ))}
            </ul>
            <p className="ndExplain">
              Missing or not-declared data is not zero. The final comparable total is unavailable
              until every required module is reported.
            </p>
          </div>
        ) : null}

        {selection.kind === "row_status" ? (
          <div className="ndDrawerBody">
            <p>{selection.detail}</p>
            {selection.statusLabel === "Incomplete" && selection.missingModules.length > 0 ? (
              <>
                <p className="ndExplain">
                  Missing modules: {selection.missingModules.join(", ")}
                </p>
                <p className="ndExplain">
                  Not declared means missing data, not zero. Incomplete helper totals should not
                  be used for comparison.
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
