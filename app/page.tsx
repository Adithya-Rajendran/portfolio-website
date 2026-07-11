import HeroContent from "@/components/home/hero-content";
import RightNow from "@/components/home/right-now";
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
        <main id="main-content" tabIndex={-1}>
            <HeroContent
                name={profile?.name}
                headline={profile?.headline}
                introduction={profile?.introduction}
                portraitSrc={portraitSrc}
                portraitAlt={profile?.portrait?.alt}
                socialLinks={profile?.socialLinks}
            />
            <RightNow
                items={profile?.currentCuriosities ?? []}
                updatedAt={profile?.curiositiesUpdatedAt}
            />
        </main>
    );
}
