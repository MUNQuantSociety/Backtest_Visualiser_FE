/** Perplexity Finance's page for a ticker: quote, chart and news outside the app. */
export function perplexityFinanceUrl(ticker: string): string {
  return `https://www.perplexity.ai/finance/${encodeURIComponent(ticker)}`;
}
