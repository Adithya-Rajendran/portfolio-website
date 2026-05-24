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

/**
 * Toolbelt strip — auto-scrolling marquee of tech logos, with edge fade
 * masks so the loop is seamless. Lives between the bio and skills
 * sections as a calm visual pause.
 */
export default function ToolsMarquee() {
    return (
        <section
            aria-label="Tools and technologies"
            className="relative w-full overflow-hidden"
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#f4f5f8] to-transparent dark:from-[#050608]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#f4f5f8] to-transparent dark:from-[#050608]"
            />

            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500 mb-6">
                Toolbelt
            </p>

            <div className="flex w-max animate-marquee">
                {[...tools, ...tools].map(({ Icon, label }, i) => (
                    <div
                        key={`${label}-${i}`}
                        className="flex items-center gap-2.5 px-6 text-slate-500 dark:text-slate-400"
                        title={label}
                    >
                        <Icon className="w-6 h-6" aria-hidden />
                        <span className="text-sm font-medium">{label}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
