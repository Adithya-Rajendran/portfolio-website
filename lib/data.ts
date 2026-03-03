import React from "react";

import { ProjectType, ExperienceType, CertificateType } from "./types";

import { FaPython } from "react-icons/fa";
import { BsShieldLock } from "react-icons/bs";
import { LuGraduationCap } from "react-icons/lu";

import djangoImg from "@/public/django.webp";
import serverImg from "@/public/homelab.webp";
import dirsearchImg from "@/public/dirsearch.webp";
import portscanImg from "@/public/portscan.webp";
import htbImg from "@/public/htb.webp";
import thmImg from "@/public/thm.webp";
import nextImg from "@/public/nextjs-website.webp";
import AWSImg from "@/public/AWS.webp";
import SecImg from "@/public/CompTIA_Security.webp";
import MTAImg from "@/public/MTA-Security-Fundamentals-2018.webp";

export const links = [
    {
        name: "Home",
        hash: "/",
    },
    {
        name: "About",
        hash: "/portfolio#about",
    },
    {
        name: "Skills",
        hash: "/portfolio#skills",
    },
    {
        name: "Certs",
        hash: "/portfolio#certs",
    },
    {
        name: "Experience",
        hash: "/portfolio#experience",
    },
    {
        name: "Projects",
        hash: "/portfolio#projects",
    },
    {
        name: "Contact",
        hash: "/portfolio#contact",
    },
] as const;

export const certData: readonly CertificateType[] = [
    {
        title: "AWS Certified Solutions Architect",
        org: "AWS",
        startDate: "September 2023",
        endDate: "September 2026",
        badge: AWSImg,
        verify: "https://www.credly.com/badges/80207866-2bf2-41a0-8c92-991295e79063/",
    },
    {
        title: "CompTIA Security+",
        org: "CompTIA",
        startDate: "August 2022",
        endDate: "August 2025",
        badge: SecImg,
        verify: "https://www.credly.com/badges/d856db28-ca1f-4189-a1a0-ff50766f5568",
    },
    {
        title: "MTA: Security Fundamentals",
        org: "Microsoft",
        startDate: "May 2018",
        endDate: "",
        badge: MTAImg,
        verify: "https://www.credly.com/badges/b0889cff-2fbc-46c0-b16e-f631fefb024b",
    },
];

export const experiencesData: readonly ExperienceType[] = [
    {
        title: "Field Software Engineer I",
        org: "Canonical (Ubuntu)",
        location: "Fremont, CA",
        description: [
            "Architected and led the deployment of large-scale private cloud solutions (OpenStack, Kubernetes, Ceph).",
            "Created automations using Python, Terraform, and Bash, reducing errors and manual effort.",
            "Partnered with core engineering and support teams to architect custom solutions for unique customer scenarios, enhancing system performance and reducing support escalations.",
            "Authored custom CIS and DISA-STIG tailoring files to assist in meeting compliance requirements like CMMC and HIPAA, as well as strengthen the overall security posture.",
            "Troubleshot issues across the entire suite, from the kernel to the networking and switches, all the way to applications running on the OS, providing patches to bugs where necessary.",
            "Documented root cause analyses and solutions in the knowledge base, improving time-to-resolution.",
            "Partnered with the sales team in the pre-sales process, leading solution-oriented discovery calls, delivering customized demonstrations, and advising clients on alternative strategies to better address their business goals.",
            "Assisted with drafting Statement of Work documents while ensuring alignment between sales, support, and engineering teams, effectively providing a solid outline of the engagement.",
            "Collaborated with product management and engineering teams by providing critical field feedback on customer use-cases and technical challenges, influencing the product roadmap.",
        ],
        icon: React.createElement(BsShieldLock),
        date: "May 2024 - Present",
    },
    {
        title: "Cybersecurity Analyst Intern",
        org: "Technical Consulting & Research, Inc. (TCR)",
        location: "Fremont, CA",
        description: [
            "Addressed 4+ cloud provider compliance issues via fit-gap analysis, improving regulatory adherence.",
            "Leveraged the MITRE ATT&CK framework to refine threat modeling processes, achieving a notable 15% reduction in system vulnerabilities and bolstering security defenses.",
            "Applied security best practices such as the principle of least privilege and network segmentation.",
            "Developed automation scripts in Python, reducing the need to direct human work hours by 1-2 hrs. per week.",
            "Built demo applications in JavaScript showing the effects and operation of compliance requirements.",
            "Orchestrated secure authentication and authorization with Okta's Auth0, enhancing user access control.",
            "Delivered detailed security reports and visualizations, significantly raising non-technical stakeholder awareness.",
            'Presented at the IGNITE and Bucknell University conferences on "Navigating AI Risks for Small Businesses."',
        ],
        icon: React.createElement(BsShieldLock),
        date: "December 2023 - May 2024",
    },
    {
        title: "Software Developer Intern",
        org: "RND4IMPACT Inc.",
        location: "San Jose, CA",
        description: [
            "In my role as a Software Development Intern, I led the design and implementation of web applications using Django, significantly enhancing system functionality and user experience.",
            "Implemented dynamic loading for TypeScript components, which boosted First Contentful Paint (FCP) by 2.4 seconds.",
            "Conducted thorough performance optimization, achieving a 15% improvement and a 75% cache hit rate through custom caching rules, which notably reduced load times.",
            "Also established rigorous code review and testing protocols, reducing bugs by 20% and ensuring high-quality code standards.",
        ],
        icon: React.createElement(FaPython),
        date: "September 2023 - April 2024",
    },
    {
        title: "Bachelor of Science, Computer Science",
        org: "University of California",
        location: "Santa Cruz, CA",
        description: [
            "I graduated from the University of California, Santa Cruz, where I was deeply involved in the Slug Security Club.",
            "As a regular participant, I participated in various cybersecurity workshops and competitions, enhancing my skills in network security and ethical hacking.",
            "Relevant Coursework: Computer Systems and C, Cryptography, Advanced Computer Networking, Principle of System Design, Artificial intelligence, Natural Language Processing",
        ],
        icon: React.createElement(LuGraduationCap),
        date: "June 2023",
    },
] as const;

export const projectsData: readonly ProjectType[] = [
    {
        title: "Home-Lab",
        description:
            "Established a comprehensive home-lab setup, fostering independent learning and practical understanding of Virtualization, Linux/Unix environments, and DevSecOps best practices.",
        tags: [
            "Virtualization",
            "Linux/Unix",
            "Active Directory",
            "RAID",
            "DevSecOps",
        ],
        imageUrl: serverImg,
    },
    {
        title: "NextJS Portfolio + Blog Website",
        description:
            "This website that you are viewing! Redesigned my personal portfolio to elevate the user experience, utilizing Next.js for improved SEO and Tailwind CSS for a modern aesthetic. Integrated Framer Motion for fluid animations and React Markdown for seamless blog content management.",
        tags: ["NextJS", "Typescript", "APIs", "Javascript", "Caching"],
        imageUrl: nextImg,
        link: {
            title: "Source Code",
            link: "https://github.com/Adithya-Rajendran/portfolio-website",
        },
    },
    {
        title: "Web-app Directory Search Tool",
        description:
            "Created a multi-threaded directory search tool for web applications, enhancing penetration testing capabilities with recursive search functions and security testing.",
        tags: [
            "Python",
            "Multi-threading",
            "Web-apps",
            "Web Security",
            "Pentesting",
        ],
        imageUrl: dirsearchImg,
        link: {
            title: "Source Code",
            link: "https://github.com/Adithya-Rajendran/dirsearch",
        },
    },
    {
        title: "Server Port Scanning Tool",
        description:
            "Developed a concurrent port scanner in Python to expedite the scanning of server ports, improving efficiency in identifying vulnerabilities during security assessments.",
        tags: [
            "Python",
            "Networking",
            "Concurrent Programming",
            "Port Scanning",
            "Security",
        ],
        imageUrl: portscanImg,
        link: {
            title: "Source Code",
            link: "https://github.com/Adithya-Rajendran/portscanner",
        },
    },
    {
        title: "Hack The Box (HTB) Enthusiast",
        description:
            "Achieved a top 700 rank on HTB, showcasing expertise in penetration testing and security practices through complex challenges, specializing in areas such as privilege escalation and security tool utilization.",
        tags: [
            "Penetration Testing",
            "Burp Suite",
            "Privilege Escalation",
            "hashcat",
            "Metasploit",
            "ldapdomaindump",
        ],
        imageUrl: htbImg,
        link: {
            title: "HackTheBox Profile",
            link: "https://app.hackthebox.com/profile/514798",
        },
    },
    {
        title: "TryHackMe (THM) Enthusiast",
        description:
            "Ranked in the top 5% of the Tryhackme Platform. Engaged in a wide range of cybersecurity challenges on THM, enhancing skills in network security and Active Directory exploitation using tools like Bloodhound and Dirbuster, demonstrating versatility in security methodologies.",
        tags: [
            "Bloodhound",
            "dirbuster",
            "Active Directory",
            "Nmap",
            "ffuf",
            "Network Security",
        ],
        imageUrl: thmImg,
        link: {
            title: "TryHackMe Profile",
            link: "https://tryhackme.com/p/Cagmas",
        },
    },
    {
        title: "Django Portfolio + CMS",
        description:
            "Developed a portfolio site with an integrated Content Management System (CMS) using Django, featuring robust data validation and Postgres for reliable data storage, enhancing content management efficiency.",
        tags: ["Django", "PostgreDB", "Docker", "HTML", "Python"],
        imageUrl: djangoImg,
        link: {
            title: "Source Code",
            link: "https://github.com/Adithya-Rajendran/portfolioWebsite",
        },
    },
] as const;

export const devopskillsData: readonly string[] = [
    "AWS",
    "XCP-NG",
    "Linux/Unix",
    "Docker",
    "Kubernetes",
    "Active Directory",
    "Git",
    "Jenkins",
    "Github Actions",
] as const;

export const devSkillsData: readonly string[] = [
    "TypeScript",
    "React",
    "Next.js",
    "Vercel",
    "Scrum",
    "Tailwind",
    "Prisma",
    "HTML",
    "Python",
    "Django",
    "DynamoDB",
    "PostgreSQL",
];

export const cyberSkillsData: readonly string[] = [
    "Wazuh",
    "SIEM",
    "Snort",
    "Burp Suite",
    "Metasploit",
    "Nmap",
    "Okta Auth0",
    "OPNSense",
    "Firewalls",
    "MITRE ATT&CK",
    "NIST",
] as const;
