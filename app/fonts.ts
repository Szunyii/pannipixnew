import { Bodoni_Moda, Jost } from "next/font/google";

// Bodoni's hairline contrast mirrors single-needle fine-line work.
export const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin", "latin-ext"],
});
