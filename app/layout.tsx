// layout.tsx

import type { Metadata } from "next";
// УДАЛЯЕМ импорты Geist и Geist_Mono
// import { Geist, Geist_Mono } from "next/font/google"; 
import "./globals.css";

// УДАЛЯЕМ настройки geistSans и geistMono

export const metadata: Metadata = {
  title: "Mochi - Cyber-Cat Fact Checker", // Обновляем название
  description: "GenLayer Intelligent Contract Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* УДАЛЯЕМ классы geistSans.variable и geistMono.variable, antialiased оставляем */}
      <body className={`antialiased`}> 
        {children}
      </body>
    </html>
  );
}