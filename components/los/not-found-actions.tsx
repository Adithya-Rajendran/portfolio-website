import { ButtonLink } from "@/components/ui/button";
import { lossOfSignalCopy as copy } from "@/lib/copy";
import { siteRoutes } from "@/lib/navigation";

/**
 * The 404's one action: Home, the primary button. The site's sections
 * follow as link rows. The console (PR 16) adds "Search the site" with
 * the missed address typed in.
 */
export default function NotFoundActions() {
    return (
        <ButtonLink href={siteRoutes.home} variant="primary">
            {copy.home}
        </ButtonLink>
    );
}
