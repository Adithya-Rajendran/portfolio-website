"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ShowMorePostsProps {
    /** Pre-rendered card nodes (server components) — this island only
     *  controls how many are visible, it never fetches or re-renders them. */
    items: React.ReactNode[];
    /** How many items are visible initially, and revealed per click. */
    initial?: number;
    /** Grid classes for the wrapping <div>, matching the caller's layout. */
    gridClassName: string;
}

/**
 * Client-side "show more" pagination island for a grid of already
 * server-rendered post cards. No data fetching happens here — cards
 * arrive as fully-formed React nodes and this component just slices the
 * array, so the server payload is unaffected by how much is revealed.
 */
export default function ShowMorePosts({
    items,
    initial = 12,
    gridClassName,
}: ShowMorePostsProps) {
    const [visible, setVisible] = useState(initial);
    const gridRef = useRef<HTMLDivElement>(null);
    // Set when a click is about to unmount the button (last reveal) so
    // focus can be handed to the grid instead of dropping to <body>.
    const focusGridRef = useRef(false);

    const shown = items.slice(0, visible);
    const hasMore = visible < items.length;

    useEffect(() => {
        if (!hasMore && focusGridRef.current) {
            focusGridRef.current = false;
            gridRef.current?.focus();
        }
    }, [hasMore]);

    return (
        <>
            <div
                ref={gridRef}
                tabIndex={-1}
                className={`${gridClassName} focus:outline-none`}
            >
                {shown}
            </div>

            <p aria-live="polite" className="sr-only">
                Showing {shown.length} of {items.length} posts
            </p>

            {hasMore && (
                <div className="mt-8 sm:mt-10 flex justify-center">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            if (visible + initial >= items.length) {
                                focusGridRef.current = true;
                            }
                            setVisible((v) => v + initial);
                        }}
                    >
                        Show more
                    </Button>
                </div>
            )}
        </>
    );
}
