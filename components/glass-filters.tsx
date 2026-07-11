/**
 * Liquid-glass SVG filters — referenced only by url(#id) from
 * globals.css. #glass-liquid warps the backdrop orbs into organic
 * shapes. Hidden, 0×0.
 */
export default function GlassFilters() {
    return (
        <svg
            aria-hidden="true"
            width="0"
            height="0"
            style={{ position: "absolute" }}
        >
            <defs>
                <filter
                    id="glass-liquid"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                    colorInterpolationFilters="sRGB"
                >
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.008 0.012"
                        numOctaves={2}
                        seed={7}
                        result="n"
                    />
                    <feGaussianBlur in="n" stdDeviation="1.5" result="nb" />
                    <feDisplacementMap
                        in="SourceGraphic"
                        in2="nb"
                        scale={68}
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />
                </filter>
            </defs>
        </svg>
    );
}
