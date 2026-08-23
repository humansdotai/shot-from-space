/**
 * Print stylesheet for the receipt, inlined by the page.
 *
 * On paper this is a document, not a screen: the site chrome, the grain, the
 * controls column and the header offset are dropped, the receipt takes the
 * full measure of the sheet, type goes black on white and the hairlines
 * survive as thin grey rules. Kept as a string so the page stays a Server
 * Component and nothing ships to the client for it.
 */
export const RECEIPT_PRINT_CSS = `
@media print {
  @page { margin: 16mm; }

  html, body {
    background: #ffffff !important;
    color: #000000 !important;
  }

  /* Site chrome, grain and every interactive control leave the page. */
  header, footer, .grain-overlay, [data-print-hide] { display: none !important; }
  body > div { padding-top: 0 !important; }

  main {
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Bands and containers stop constraining the measure on paper. */
  main section { padding-top: 0 !important; padding-bottom: 0 !important; }
  main section > div { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }

  /* The document takes the whole sheet once its controls column is gone. */
  [data-receipt] {
    grid-column: 1 / -1 !important;
    border: none !important;
  }

  [data-receipt] * {
    background: transparent !important;
    color: #000000 !important;
    box-shadow: none !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  [data-receipt] [class*="border"] { border-color: #b8b8b8 !important; }

  /* Registration marks are screen furniture; dotted leaders survive. */
  [data-receipt] div[aria-hidden="true"] { display: none !important; }

  [data-receipt] section { break-inside: avoid; page-break-inside: avoid; }

  [data-receipt] a { text-decoration: none !important; }
}
`;
