import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import SectionSpy from "@/components/portfolio/section-spy";
import CareerSectionHeading from "@/components/portfolio/section-heading";
import { urlForImage } from "@/lib/sanity-image";
import type { CredentialListItem } from "@/lib/sanity-client";
import { credentialLifecycle } from "@/lib/content-rules";

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
}: {
    certifications: CredentialListItem[];
}) {
    if (!certifications.length) return null;
    return (
        <SectionSpy
            section="Certifications"
            threshold={0.35}
            id="certifications"
            className="career-section"
        >
            <CareerSectionHeading
                title="Certifications"
                description="Credentials, with verification and current status."
            />
            <ul className="career-credentials">
                {certifications.map((credential) => {
                    const status =
                        credential.lifecycleStatus ||
                        credentialLifecycle(credential);
                    const issued = formatMonth(credential.issuedOn);
                    const expires = formatMonth(credential.expiresOn);
                    const content = (
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
                                    width={56}
                                    height={56}
                                    sizes="56px"
                                    className="career-badge"
                                />
                            ) : (
                                <span
                                    className="career-credential-initial"
                                    aria-hidden
                                >
                                    {credential.title.slice(0, 2).toUpperCase()}
                                </span>
                            )}
                            <span className="career-credential-body">
                                <span className="career-credential-title">
                                    {credential.title}
                                </span>
                                <span className="career-credential-issuer">
                                    {credential.issuer}
                                </span>
                                <span className="career-credential-date">
                                    {issued ? `Issued ${issued}` : ""}
                                    {credential.lifetime
                                        ? " · No expiry"
                                        : expires
                                          ? ` · ${status === "expired" ? "Expired" : "Expires"} ${expires}`
                                          : ""}
                                </span>
                                {credential.credentialId && (
                                    <span className="career-credential-id">
                                        ID {credential.credentialId}
                                    </span>
                                )}
                                <span
                                    className={`career-status career-status-${status}`}
                                >
                                    {statusLabels[status]}
                                </span>
                            </span>
                            {credential.verificationUrl && (
                                <ArrowUpRight
                                    size={17}
                                    aria-hidden
                                    className="career-credential-arrow"
                                />
                            )}
                        </>
                    );
                    return (
                        <li key={credential._key}>
                            {credential.verificationUrl ? (
                                <a
                                    className="career-credential"
                                    href={credential.verificationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {content}
                                </a>
                            ) : (
                                <div className="career-credential">
                                    {content}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </SectionSpy>
    );
}
