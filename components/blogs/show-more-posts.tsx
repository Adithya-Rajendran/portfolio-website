"use client";

import { useEffect, useRef, useState } from "react";

interface ShowMorePostsProps {
    /** Pre-rendered row nodes (server components) — this island only
     *  controls how many are visible, it never fetches or re-renders them. */
    items: React.ReactNode[];
    /** How many items are visible initially, and revealed per click. */
    initial?: number;
    /** Classes for the wrapping <div>, matching the caller's list layout. */
    listClassName: string;
}

/**
 * Client-side "show more" pagination island for a list of already
 * server-rendered post rows. No data fetching happens here — rows
 * arrive as fully-formed React nodes and this component just slices the
 * array, so the server payload is unaffected by how much is revealed.
 */
export default function ShowMorePosts({
    items,
    initial = 12,
    listClassName,
}: ShowMorePostsProps) {
    const [visible, setVisible] = useState(initial);
    const listRef = useRef<HTMLDivElement>(null);
    // Set when a click is about to unmount the button (last reveal) so
    // focus can be handed to the list instead of dropping to <body>.
    const focusListRef = useRef(false);

    const shown = items.slice(0, visible);
    const hasMore = visible < items.length;

    useEffect(() => {
        if (!hasMore && focusListRef.current) {
            focusListRef.current = false;
            listRef.current?.focus();
        }
    }, [hasMore]);

    return (
        <>
            <div
                ref={listRef}
                tabIndex={-1}
                className={`${listClassName} focus:outline-none`}
            >
                {shown}
            </div>

            <p aria-live="polite" className="sr-only">
                Showing {shown.length} of {items.length} posts
            </p>

            {hasMore && (
                <div className="mt-8 sm:mt-10 flex justify-center">
                    <button
                        type="button"
                        className="font-term text-sm font-bold rounded-row px-4 py-2.5 border border-accent-soft text-accent hover:bg-accent-soft transition-colors"
                        onClick={() => {
                            if (visible + initial >= items.length) {
                                focusListRef.current = true;
                            }
                            setVisible((v) => v + initial);
                        }}
                    >
                        [ more --count{" "}
                        {Math.min(initial, items.length - visible)} ]
                    </button>
                </div>
            )}
        </>
    );
}
