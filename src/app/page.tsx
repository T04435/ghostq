import { GhostQApp } from "@/components/ghostq-app";

export default function Home() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Write a song for your next crowd</h1>
        <p className="max-w-2xl text-muted-foreground">
          Tell GhostQ your sound and who you&apos;re playing to. An agent reads that crowd&apos;s taste through Qloo, then writes an original song sheet. Every line shows the
          Qloo signal behind it.
        </p>
      </div>
      <GhostQApp />
    </div>
  );
}
