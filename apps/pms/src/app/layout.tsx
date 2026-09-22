import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { productDescription } from "@/lib/product";

export const metadata: Metadata = {
  title: "Practice home",
  description: productDescription(),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
