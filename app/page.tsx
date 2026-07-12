import HeroContent from "@/components/home/hero-content";
import RightNow from "@/components/home/right-now";
import TerminalSection from "@/components/terminal/terminal-section";
import { getProfile } from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";

export default async function Home() {
    const profile = await getProfile();
    const portraitSrc = profile?.portrait?.asset
        ? urlForImage(profile.portrait)
              .width(720)
              .height(720)
              .fit("crop")
              .auto("format")
              .url()
        : "/hero.webp";

    return (
        <main id="main-content" tabIndex={-1} data-hide-site-footer>
            <TerminalSection
                as="div"
                command="whoami"
                animatePrompt
                className="mx-auto flex min-h-[calc(100svh-var(--site-header-height)-5rem)] w-full max-w-6xl flex-col justify-center px-5 py-12 sm:px-8 sm:py-16 lg:py-20"
                promptClassName="mb-8"
            >
                <HeroContent
                    name={profile?.name}
                    headline={profile?.headline}
                    introduction={profile?.introduction}
                    portraitSrc={portraitSrc}
                    portraitAlt={profile?.portrait?.alt}
                    socialLinks={profile?.socialLinks}
                />
                <RightNow
                    embedded
                    items={profile?.currentCuriosities ?? []}
                    updatedAt={profile?.curiositiesUpdatedAt}
                />
            </TerminalSection>
        </main>
    );
}
