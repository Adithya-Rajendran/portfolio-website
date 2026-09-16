import { ChevronDown } from "lucide-react";
import type { PostHeading } from "./utils";

export default function MobileToc({ headings }: { headings: PostHeading[] }) {
    if (!headings.length) return null;
    return (
        <nav aria-label="On this page" className="journal-mobile-toc">
            <details>
                <summary>
                    On this page <ChevronDown aria-hidden size={16} />
                </summary>
                <ul>
                    {headings.map((heading) => (
                        <li key={heading.key} data-level={heading.level}>
                            <a href={`#${heading.id}`}>{heading.text}</a>
                        </li>
                    ))}
                </ul>
            </details>
        </nav>
    );
}
