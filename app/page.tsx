"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("../src/App").then(mod => ({ default: mod.default })), { ssr: false });

export default function Home() {
  return <App />;
}
