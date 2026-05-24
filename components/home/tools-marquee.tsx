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
 * Auto-scrolling horizontal marquee of tech logos. Duplicates the list
 * once so the CSS `translateX(-50%)` loop is seamless.
 */
export default function ToolsMarquee() {
    return (
        <section
            aria-label="Tools and technologies"
            className="relative w-full overflow-hidden py-12"
        >
            {/* Edge fade masks */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#f5f7fb] to-transparent dark:from-[#07091a]"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#f5f7fb] to-transparent dark:from-[#07091a]"
            />

            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500 mb-8">
                Tools of the trade
            </p>

            <div className="flex w-max animate-marquee">
                {[...tools, ...tools].map(({ Icon, label }, i) => (
                    <div
                        key={`${label}-${i}`}
                        className="flex items-center gap-3 px-8 text-slate-500 dark:text-slate-400"
                        title={label}
                    >
                        <Icon className="w-7 h-7" aria-hidden="true" />
                        <span className="text-sm font-medium">{label}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
