import { cn } from "cn";
import { appVersion, envTag, versionText, type AppVersion } from "@/lib/version";

const link = "rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The running version, variant B "Pill, tag @ hash" of the shared VersionBadge design: the tag links to its GitHub
 * release, the hash to its commit. Off production, a square marker, the env word and the branch (preview) or "dirty"
 * (local) come first on a tinted pill, so a preview or local build can't pass for production. Colour is never the
 * only signal.
 */
export function VersionBadge({ v = appVersion }: { v?: AppVersion }) {
  const env = envTag(v);
  const extra = env === "preview" ? v.branch : env === "local" && v.dirty ? "dirty" : "";
  return (
    <span
      title={versionText(v)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs",
        env === "production" && "border-(--brand,var(--primary)) text-(--brand,var(--primary))",
        env === "preview" && "border-env-preview-border bg-env-preview-surface text-foreground/80",
        env === "local" && "border-env-local-border bg-env-local-surface text-foreground/80",
      )}
    >
      {env !== "production" && (
        <>
          <span aria-hidden="true" className={cn("size-2", env === "preview" ? "bg-env-preview" : "bg-env-local")} />
          <span className={cn("font-semibold", env === "preview" ? "text-env-preview" : "text-env-local")}>{env}</span>
          {extra && <span className={env === "preview" ? "text-env-preview-muted" : "text-env-local-muted"}>{extra}</span>}
        </>
      )}
      <a href={v.releaseUrl} className={link}>
        v{v.version}
      </a>
      <span className="text-muted-foreground">@</span>
      <a href={v.commitUrl} className={link}>
        {v.shortSha}
      </a>
    </span>
  );
}
