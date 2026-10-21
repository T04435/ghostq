import { GhostQApp } from "@/components/ghostq-app";

export default function Home() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Write a song for your next crowd</h1>
        <p className="max-w-2xl text-muted-foreground">
          Name an artist. GhostQ reads their crowd from Qloo (where the fans are, how old they are, what they love), then writes an original song for that crowd. Every
          line shows the Qloo signal behind it.
        </p>
      </div>
      <GhostQApp />
    </div>
  );
}

