import { ButtonLink } from "@/components/ui/button";
import { siteRoutes } from "@/lib/navigation";

/**
 * The 404's recovery links. Home is the primary action until the console
 * (PR 16) adds "Search the site" with the missed address typed in.
 */
export default function NotFoundActions() {
    return (
        <>
            <ButtonLink href={siteRoutes.home} variant="primary">
                Home
            </ButtonLink>
            <ButtonLink href={siteRoutes.blog}>Flight Log</ButtonLink>
            <ButtonLink href={siteRoutes.portfolio}>Missions</ButtonLink>
        </>
    );
}
