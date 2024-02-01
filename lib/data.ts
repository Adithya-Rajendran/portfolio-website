import React from "react";

import { ProjectType } from "./types";
import { ExperienceType } from "./types";

import { FaPython } from "react-icons/fa";
import { BsShieldLock } from "react-icons/bs";
import { LuGraduationCap } from "react-icons/lu";

import djangoImg from "@/public/django.webp";
import serverImg from "@/public/homelab.webp";
import dirsearchImg from "@/public/dirsearch.webp";
import portscanImg from "@/public/portscan.webp";
import htbImg from "@/public/htb.webp";
import thmImg from "@/public/thm.webp";
import nextImg from "@/public/nextjs-website.png";

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

export const experiencesData: readonly ExperienceType[] = [
    {
        title: "Graduated University of California, Santa Cruz",
        org: "University",
        location: "Santa Cruz, CA",
        description:
            "I graduated while being a regular participant of the Slug Security (Cybersecurity) club.",
        icon: React.createElement(LuGraduationCap),
        date: "June 2023",
    },
    {
        title: "Software Developer Intern",
        org: "RND4IMPACT Inc.",
        location: "San Jose, CA",
        description:
            "Using Python frameworks like Django and Pandas, implementing validation mechanisms to reduce bugs, and conducting testing to optimize performance.",
        icon: React.createElement(FaPython),
        date: "Spetember 2023 - Present",
    },
    {
        title: "Cybersecurity Analyst Intern",
        org: "Technical Consulting & Research, Inc.",
        location: "Fremont, CA",
        description:
            "Conducted fit-gap analyses, adhered to industry best practices for secure infrastructure, and created reports on vulnerabilities with recommended remediation strategies",
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
        title: "",
        description: "",
        tags: [""],
        imageUrl: "",
    },
    {
        title: "Django Portfolio + CMS",
        description:
            "Build a full-fledged portfolio using Django integrated with Postgres DB and created the required models for controlled CMS integration.",
        tags: ["Django", "PostgreDB", "Docker", "HTML", "Python"],
        imageUrl: djangoImg,
    },
    {
        title: "Home-Lab",
        description:
            "Set up a robust home-lab environment that fosters continuous learning and independence from tech conglomerates.",
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
            "A multi-threaded web app pen-testing tool that allows the user to scan the exposed subdirectories of a website.",
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
            "A simple concurrent port scanner written in Python that scans a target's ports within a specified range concurrently.",
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
            "Ranked in the top 1000 on Hack The Box (HTB), I actively tackle various challenges and machines, honing my skills.",
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
            "Active participant on TryHackMe (THM), engaging in a variety of cybersecurity challenges to enhance my capabilities.",
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
    "Cloud Security",
    "Incident Response",
    "Network Security",
    "Penetration Testing",
    "SIEM",
    "Vulnerability Assessment",
    "AWS",
    "Active Directory",
    "Linux/Unix",
    "Security Policies",
    "Docker",
    "MITRE ATT&CK",
    "NIST",
    "PostgreSQL",
    "Snort",
    "Python",
    "MongoDB",
    "PostgreSQL",
    "HTML",
    "JavaScript",
    "TypeScript",
    "React",
    "Next.js",
    "Git",
    "Tailwind",
    "Prisma",
    "Django",
    "Framer Motion",
] as const;
