/** The paper studio's palette. */
export const C: Record<string, string>;

export interface PaperOptions {
  seed?: number;
  wobble?: number;
  freq?: number;
  border?: number;
  shadow?: number;
  blur?: number;
  dx?: number;
  dy?: number;
  grain?: number;
  region?: string | null;
}

/** An SVG `<filter>` that makes its content look like cut paper. */
export function paper(id: string, options?: PaperOptions): string;
