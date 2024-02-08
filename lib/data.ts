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
        name: "Projects",
        hash: "/#projects",
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
        org: "Amazon Web Services (AWS)",
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
        title: "Graduated University of California, Santa Cruz",
        org: "University",
        location: "Santa Cruz, CA",
        description:
            "I graduated from the University of California, Santa Cruz, where I was deeply involved in the Slug Security Club. As a regular participant, I contributed to various cybersecurity workshops and competitions, enhancing my skills in network security and ethical hacking.",
        icon: React.createElement(LuGraduationCap),
        date: "June 2023",
    },
    {
        title: "Software Developer Intern",
        org: "RND4IMPACT Inc.",
        location: "San Jose, CA",
        description:
            "At RND4IMPACT Inc., I employed Django and Pandas to develop web applications, significantly reducing bugs by implementing advanced validation mechanisms and conducting performance optimizations, resulting in a 20% improvement in system efficiency.",
        icon: React.createElement(FaPython),
        date: "Spetember 2023 - Present",
    },
    {
        title: "Cybersecurity Analyst Intern",
        org: "Technical Consulting & Research, Inc.",
        location: "Fremont, CA",
        description:
            "I conducted fit-gap analyses and enforced industry best practices for secure infrastructure, complemented by my experience integrating Auth0 for robust authentication solutions. This involved creating detailed vulnerability reports and recommending remediation strategies, thereby enhancing system security and user authentication processes.",
        icon: React.createElement(BsShieldLock),
        date: "December 2023 - present",
    },
] as const;

export const projectsData: readonly ProjectType[] = [
    {
        title: "NextJS Portfolio + Blog Website",
        description:
            "This website that you are viewing! I was unsatisfied with how the previous portfolio website looked and felt so I wanted to remake the website. Using common technologies like Tailwind CSS, Typescript, Framer Motion, and React Markdown to ensure a smooth user experience.",
        tags: ["NextJS", "Typescript", "APIs", "Javascript", "Caching"],
        imageUrl: nextImg,
    },
    {
        title: "Active Directory Lab",
        description:
            "Set up an Active Directory network, with a Domain Controller, and two clients all connected to a Wazuh server for alerts. Then I connected my Linux machine to this network and performed and documented the common AD attacks. I talk more about this on my blogs.",
        tags: [
            "Active Directory",
            "Automation",
            "SIEM",
            "Pentesting",
            "Wazuh",
            "Pfsense",
        ],
        imageUrl: adImg,
    },
    {
        title: "Django Portfolio + CMS",
        description:
            "Build a full-fledged portfolio using Django integrated with Postgres DB and created the required models for controlled CMS integration. This was the previous portfolio website, it featured a CMS with robust data validations systems to ensure data consistency.",
        tags: ["Django", "PostgreDB", "Docker", "HTML", "Python"],
        imageUrl: djangoImg,
    },
    {
        title: "Home-Lab",
        description:
            "Set up a robust home-lab environment that fosters continuous learning and independence from tech conglomerates. I go in-depth on the setup in my blogs.",
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
            "A multi-threaded web app pen-testing tool that allows the user to scan the exposed subdirectories of a website. The purpose of this project is to understand how directory searching and to expand it to perform recursive searches.",
        tags: [
            "Python",
            "Multi-threading",
            "Web-apps",
            "Web Security",
            "Pentesting",
        ],
        imageUrl: dirsearchImg,
    },
    {
        title: "Server Port Scanning Tool",
        description:
            "A simple concurrent port scanner, written in Python, that scans a target's ports within a specified range concurrently. The goal for this project is to quickly scan non-standard ports during CTF challenges.",
        tags: [
            "Python",
            "Networking",
            "Concurrent Programming",
            "Port Scanning",
            "Security",
        ],
        imageUrl: portscanImg,
    },
    {
        title: "Hack The Box (HTB) Enthusiast",
        description:
            "Ranked in the top 700 on Hack The Box (HTB), I've honed my cybersecurity skills through rigorous challenges and machines, specializing in penetration testing, privilege escalation, and various security tools.",
        tags: [
            "Penetration Testing",
            "Burp Suite",
            "Privilege Escalation",
            "hashcat",
            "Metasploit",
            "ldapdomaindump",
        ],
        imageUrl: htbImg,
    },
    {
        title: "TryHackMe (THM) Enthusiast",
        description:
            "As an active TryHackMe (THM) enthusiast, I engage with a diverse array of cybersecurity challenges, leveraging tools like Bloodhound, Dirbuster, and Nmap to enhance my capabilities in network security and Active Directory.",
        tags: [
            "Bloodhound",
            "dirbuster",
            "Active Directory",
            "Nmap",
            "ffuf",
            "Network Security",
        ],
        imageUrl: thmImg,
    },
] as const;

export const skillsData: readonly string[] = [
    "Wazuh",
    "SIEM",
    "Snort",
    "Burp Suite",
    "Metasploit",
    "Nmap",
    "AWS",
    "Okta Auth0",
    "XCP-NG",
    "OPNSense",
    "Linux/Unix",
    "Docker",
    "Kubernetes",
    "Firewalls",
    "Active Directory",
    "MITRE ATT&CK",
    "NIST",
    "Git",
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
] as const;
