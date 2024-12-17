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
import adImg from "@/public/ADNetworkOverview.webp";
import AWSImg from "@/public/AWS.webp";
import SecImg from "@/public/CompTIA_Security.webp";
import MTAImg from "@/public/MTA-Security-Fundamentals-2018.webp";

export const links = [
    {
        name: "Home",
        hash: "/#home",
    },
    {
        name: "About",
        hash: "/#about",
    },
    {
        name: "Skills",
        hash: "/#skills",
    },
    {
        name: "Certs",
        hash: "/#certs",
    },
    {
        name: "Experience",
        hash: "/#experience",
    },
    {
        name: "Projects",
        hash: "/#projects",
    },
    {
        name: "Contact",
        hash: "/#contact",
    },
    {
        name: "Blogs",
        hash: "/blogs",
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
        title: "Bachelor of Science, Computer Science",
        org: "University of California,",
        location: "Santa Cruz, CA",
        description: [
            "I graduated from the University of California, Santa Cruz, where I was deeply involved in the Slug Security Club.",
            "As a regular participant, I participated in various cybersecurity workshops and competitions, enhancing my skills in network security and ethical hacking.",
            "Relevant Coursework: Computer Systems and C, Cryptography, Advanced Computer Networking, Principle of System Design, Artificial intelligence, Natural Language Processing",
        ],
        icon: React.createElement(LuGraduationCap),
        date: "June 2023",
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
        date: "Spetember 2023 - April 2024",
    },
    {
        title: "Cybersecurity Analyst Intern",
        org: "Technical Consulting & Research, Inc.",
        location: "Fremont, CA (Remote)",
        description: [
            "As a Cybersecurity Analyst Intern, I addressed over six compliance issues through fit-gap analysis, enhancing cloud provider regulatory adherence.",
            "Utilized the MITRE ATT&CK framework to refine threat modeling, achieving a 15% reduction in system vulnerabilities.",
            "Orchestrated secure authentication and authorization solutions using Okta’s Auth0, significantly enhancing user access control, and delivered detailed security reports, elevating stakeholder awareness of cybersecurity measures.",
            "Additionally, improved team productivity by leveraging advanced Microsoft Office Suite features for data analysis and presentation.",
            'Presented at the IGNITE and Bucknell University conferences on "Navigating AI Risks for Small Businesses."',
        ],
        icon: React.createElement(BsShieldLock),
        date: "December 2023 - May 2024",
    },
    {
        title: "Cloud Field Engineer",
        org: "Canonical",
        location: "Fremont, CA (Remote)",
        description: [
            "In my role as a Cloud Field Engineer, I collaborated with clients to deploy and optimize cloud infrastructure solutions, leveraging technologies like OpenStack, Kubernetes, and Ubuntu-based systems.",
            "Delivered tailored consulting to enhance scalability and performance, aligning infrastructure with enterprise needs.",
            "Automated deployment processes using Juju and MAAS (Metal as a Service), streamlining cloud operations and reducing manual workloads.",
            "Facilitated technical troubleshooting and system integration, ensuring reliability and efficiency for customer environments."
        ],
        icon: React.createElement(BsShieldLock),
        date: "May 2024 - Present",
    },
] as const;

export const projectsData: readonly ProjectType[] = [
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
        title: "Active Directory Lab",
        description:
            "Constructed a simulated network using Active Directory, complete with automated SIEM alerts via Wazuh, to demonstrate and document common security threats and defense mechanisms.",
        tags: [
            "Active Directory",
            "Automation",
            "SIEM",
            "Pentesting",
            "Wazuh",
            "Pfsense",
        ],
        imageUrl: adImg,
        link: {
            title: "Blog post",
            link: "https://adithya-rajendran.com/blogs/active-directory-lab",
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
