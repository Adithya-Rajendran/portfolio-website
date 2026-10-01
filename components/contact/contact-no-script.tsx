import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { contactCopy } from "@/lib/copy";
import type { ExternalLink } from "@/lib/sanity-client";

/**
 * What a reader without JavaScript gets in place of the form, which needs
 * it for BotID's challenge (plan §2.5.6): the reason, and the LinkedIn
 * profile from the Sanity profile as the way on. Directive-free, so
 * server and client components can render it.
 */
export default function ContactNoScript({
    linkedIn,
    className,
}: {
    linkedIn?: ExternalLink;
    className?: string;
}) {
    return (
        <noscript>
            <div className={className}>
                <p>{contactCopy.noScript}</p>
                {linkedIn ? (
                    <p>
                        <a
                            className={buttonClass({})}
                            href={linkedIn.url}
                            rel="noopener noreferrer"
                        >
                            {contactCopy.linkedIn}
                            <Icon name="external" />
                        </a>
                    </p>
                ) : null}
            </div>
        </noscript>
    );
}
