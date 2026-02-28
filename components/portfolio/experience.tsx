"use client";

import React from "react";
import SectionHeading from "../section-heading";
import {
    VerticalTimeline,
    VerticalTimelineElement,
} from "react-vertical-timeline-component";
import "react-vertical-timeline-component/style.min.css";
import { experiencesData } from "@/lib/data";
import { useSectionInView } from "@/lib/hooks";
import { useTheme } from "@/context/theme-context";

export default function Experience() {
    const { ref, inView } = useSectionInView("Experience", 0.3);
    const { theme } = useTheme();

    const [isVisible, setIsVisible] = React.useState(false);

    React.useEffect(() => {
        if (inView) {
            setIsVisible(true);
        }
    }, [inView]);

    return (
        <section
            id="experience"
            ref={ref}
            className="scroll-mt-28 mb-28 sm:mb-40"
        >
            <SectionHeading>My experience</SectionHeading>
            <VerticalTimeline lineColor="">
                {experiencesData.map((item) => (
                    <VerticalTimelineElement
                        key={item.title}
                        visible={isVisible}
                        contentStyle={{
                            background:
                                theme === "light"
                                    ? "#f8fafc"
                                    : "rgba(255, 255, 255, 0.03)",
                            boxShadow: "none",
                            border:
                                theme === "light"
                                    ? "1px solid #e2e8f0"
                                    : "1px solid rgba(255, 255, 255, 0.08)",
                            textAlign: "left",
                            padding: "1.3rem 2rem",
                        }}
                        contentArrowStyle={{
                            borderRight:
                                theme === "light"
                                    ? "0.4rem solid #94a3b8"
                                    : "0.4rem solid rgba(52, 211, 153, 0.4)",
                        }}
                        date={item.date}
                        icon={item.icon}
                        iconStyle={{
                            background:
                                theme === "light"
                                    ? "white"
                                    : "rgba(255, 255, 255, 0.05)",
                            fontSize: "1.5rem",
                            color:
                                theme === "light"
                                    ? "#0f172a"
                                    : "#34d399",
                        }}
                    >
                        <h3 className="font-semibold capitalize">
                            {item.title}
                        </h3>
                        <p className="font-normal !mt-0">{item.org}</p>
                        <p className="font-normal mt-0">{item.location}</p>
                        {item.description.map((desc, index) => (
                            <p
                                key={index}
                                className="!mt-1 !font-normal text-slate-600 dark:text-slate-400"
                            >
                                {`• ${desc}`}
                            </p>
                        ))}
                    </VerticalTimelineElement>
                ))}
            </VerticalTimeline>
        </section>
    );
}
