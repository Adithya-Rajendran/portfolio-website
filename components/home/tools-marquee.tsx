import {
    SiKubernetes,
    SiOpenstack,
    SiDocker,
    SiTerraform,
    SiPython,
    SiTypescript,
    SiLinux,
    SiNextdotjs,
    SiNginx,
    SiPostgresql,
    SiGithubactions,
    SiAnsible,
    SiGrafana,
} from "react-icons/si";
import { FaAws } from "react-icons/fa6";

const tools = [
    { Icon: FaAws, label: "AWS" },
    { Icon: SiKubernetes, label: "Kubernetes" },
    { Icon: SiOpenstack, label: "OpenStack" },
    { Icon: SiDocker, label: "Docker" },
    { Icon: SiTerraform, label: "Terraform" },
    { Icon: SiAnsible, label: "Ansible" },
    { Icon: SiPython, label: "Python" },
    { Icon: SiTypescript, label: "TypeScript" },
    { Icon: SiLinux, label: "Linux" },
    { Icon: SiNextdotjs, label: "Next.js" },
    { Icon: SiNginx, label: "Nginx" },
    { Icon: SiPostgresql, label: "PostgreSQL" },
    { Icon: SiGithubactions, label: "GitHub Actions" },
    { Icon: SiGrafana, label: "Grafana" },
];

function ToolItems() {
    return (
        <>
            {tools.map(({ Icon, label }) => (
                <div
                    key={label}
                    className="flex items-center gap-2.5 px-6 text-slate-500 dark:text-slate-400"
                >
                    <Icon className="w-6 h-6" aria-hidden />
                    <span className="text-sm font-medium">{label}</span>
                </div>
            ))}
        </>
    );
}

/**
 * Toolbelt strip — auto-scrolling marquee of tech logos, with edge fade
 * masks so the loop is seamless. Lives between the bio and skills
 * sections as a calm visual pause. The second copy of the list only
 * exists to make the loop seamless, so it is hidden from assistive
 * tech; reduced-motion users get a static row instead.
 */
export default function ToolsMarquee() {
    return (
        <section
            aria-label="Tools and technologies"
            // Hover/focus pauses the loop — WCAG 2.2.2 needs an on-page
            // way to stop >5s auto-motion even without an OS preference.
            className="group relative w-full overflow-hidden"
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-canvas to-transparent dark:from-canvas-dark"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-canvas to-transparent dark:from-canvas-dark"
            />

            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400 mb-6">
                Toolbelt
            </p>

            <div className="flex w-max motion-safe:animate-[marquee_38s_linear_infinite] motion-safe:will-change-transform group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
                <ToolItems />
                <div aria-hidden="true" className="flex">
                    <ToolItems />
                </div>
            </div>
        </section>
    );
}
