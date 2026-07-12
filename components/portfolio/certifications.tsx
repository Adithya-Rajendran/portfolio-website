import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import SectionSpy from "@/components/portfolio/section-spy";
import { SectionHeading } from "@/components/section-heading";
import { urlForImage } from "@/lib/sanity-image";
import { cn } from "@/lib/utils";
import type { CredentialListItem } from "@/lib/sanity-client";
import { credentialLifecycle } from "@/lib/content-rules";

interface CertificationsProps {
    certifications: CredentialListItem[];
}

const statusStyles = {
    active: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    lifetime:
        "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300",
    expired:
        "border-slate-300/70 bg-slate-200/50 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400",
} as const;

const statusLabels = {
    active: "Active",
    lifetime: "Lifetime",
    expired: "Expired",
} as const;

function formatMonth(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(parsed);
}

export default function Certifications({
    certifications,
}: CertificationsProps) {
    if (certifications.length === 0) return null;

    const columns =
        certifications.length === 1
            ? ""
            : certifications.length === 3
              ? "md:grid-cols-2 lg:grid-cols-3"
              : "md:grid-cols-2";

    return (
        <SectionSpy
            section="Certifications"
            threshold={0.35}
            id="certifications"
            className="scroll-mt-32"
        >
            <SectionHeading
                title="Certifications"
                description="Issued and expiry dates stay visible, including lifetime and expired credentials."
            />

            <ul className={cn("grid gap-4", columns)}>
                {certifications.map((credential) => {
                    const status =
                        credential.lifecycleStatus ||
                        credentialLifecycle(credential);
                    const issued = formatMonth(credential.issuedOn);
                    const expires = formatMonth(credential.expiresOn);
                    const body = (
                        <>
                            {credential.badge?.asset ? (
                                <Image
                                    src={urlForImage(credential.badge)
                                        .width(120)
                                        .height(120)
                                        .fit("max")
                                        .auto("format")
                                        .url()}
                                    alt={credential.badge.alt || ""}
                                    width={64}
                                    height={64}
                                    sizes="64px"
                                    className="size-16 shrink-0 object-contain"
                                />
                            ) : (
                                <span
                                    aria-hidden
                                    className="grid size-16 shrink-0 place-items-center rounded-[1rem] border border-accent-soft bg-accent-soft font-display text-lg font-semibold text-accent"
                                >
                                    {credential.title
                                        ?.slice(0, 2)
                                        .toUpperCase()}
                                </span>
                            )}

                            <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                    <span className="font-display text-lg font-semibold leading-snug text-slate-900 dark:text-white">
                                        {credential.title}
                                    </span>
                                    <span
                                        className={`rounded-full border px-2 py-0.5 font-term text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${statusStyles[status]}`}
                                    >
                                        {statusLabels[status]}
                                    </span>
                                </span>
                                <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                                    {credential.issuer}
                                </span>
                                <span className="mt-3 block font-term text-[0.68rem] leading-5 text-slate-500 dark:text-slate-400">
                                    {issued
                                        ? `Issued ${issued}`
                                        : "Issue date pending"}
                                    {credential.lifetime
                                        ? " · No expiry"
                                        : expires
                                          ? ` · ${status === "expired" ? "Expired" : "Expires"} ${expires}`
                                          : ""}
                                </span>
                                {credential.credentialId && (
                                    <span className="mt-1 block truncate font-term text-[0.65rem] text-slate-400 dark:text-slate-500">
                                        ID {credential.credentialId}
                                    </span>
                                )}
                            </span>

                            {credential.verificationUrl && (
                                <ArrowUpRight
                                    aria-hidden
                                    className="size-4 shrink-0 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                />
                            )}
                        </>
                    );

                    return (
                        <li key={credential._key}>
                            {credential.verificationUrl ? (
                                <a
                                    href={credential.verificationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex h-full items-start gap-5 rounded-card border border-slate-200/80 bg-white/55 p-5 transition-colors hover:border-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))] dark:border-white/10 dark:bg-white/[0.035] sm:p-6"
                                >
                                    {body}
                                </a>
                            ) : (
                                <div className="flex h-full items-start gap-5 rounded-card border border-slate-200/80 bg-white/55 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
                                    {body}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </SectionSpy>
    );
}
