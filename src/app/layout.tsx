import type { Metadata } from "next";
import Nav from "@ui/Nav";
import { SearchProvider } from "@context/SearchContext";
import CloudWatchRum from "./components/CloudWatchRum";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Nightfall Clan",
  icons: {
    icon: "/logo-silver.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const buildTimestamp = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ?? "";

  return (
    <html lang="en" data-build-timestamp={buildTimestamp}>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </head>
      <body>
        <CloudWatchRum />
        <SearchProvider>
          <div id="__next">
            <Nav />
            {children}
          </div>
        </SearchProvider>
      </body>
    </html>
  );
}
