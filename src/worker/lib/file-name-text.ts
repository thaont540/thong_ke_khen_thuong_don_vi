/** Last `max` code points of a file name (never splits a surrogate pair). */
export const tailCodePoints = (name: string, max: number): string =>
  Array.from(name).slice(-max).join("");

/** encodeURIComponent that cannot throw: lone surrogates become U+FFFD first. */
export const safeEncodeURIComponent = (s: string): string =>
  encodeURIComponent(
    s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD"),
  );
