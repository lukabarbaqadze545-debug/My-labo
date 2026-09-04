/// <reference types="vite/client" />

/**
 * Vite's `?url` suffix returns the emitted asset's URL as a string. TypeScript
 * has no idea about the suffix on its own, and the PDF worker is loaded that
 * way so the parser runs off the main thread.
 */
declare module '*?url' {
  const url: string;
  export default url;
}
