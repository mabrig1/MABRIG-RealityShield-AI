import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MABRIG RealityShield AI",
  description: "Camera-first authenticity, deepfake and impersonation defense.",
};

export const viewport: Viewport = {
  themeColor: "#07130f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
