import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { Question } from "@/lib/crew";

/**
 * The owner's current questions as hairline rows (the log index's
 * grammar): the question, and the owner's note under it in the serif;
 * unnumbered, since a question's words are its name. A question that
 * points somewhere links there. About's current focus.
 */
export default function Questions({
    items,
    labelledBy,
}: {
    items: readonly Question[];
    labelledBy?: string;
}) {
    if (!items.length) return null;
    return (
        <ol className="q-list" role="list" aria-labelledby={labelledBy}>
            {items.map((item) => (
                <li className="q-item" key={item.id}>
                    <p className="q-item__title">
                        {item.href && item.external ? (
                            <a
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {item.title}
                                <Icon name="external" />
                            </a>
                        ) : item.href ? (
                            <Link href={item.href}>{item.title}</Link>
                        ) : (
                            item.title
                        )}
                    </p>
                    {item.note ? (
                        <p className="q-item__note">{item.note}</p>
                    ) : null}
                </li>
            ))}
        </ol>
    );
}
