import React from "react";
import { FaPython } from "react-icons/fa";
import { BsShieldLock } from "react-icons/bs";
import { LuGraduationCap } from "react-icons/lu";
import corpcommentImg from "@/public/corpcomment.png";
import rmtdevImg from "@/public/rmtdev.png";
import wordanalyticsImg from "@/public/wordanalytics.png";

export const links = [
  {
    name: "Home",
    hash: "#home",
  },
  {
    name: "About",
    hash: "#about",
  },
  {
    name: "Projects",
    hash: "#projects",
  },
  {
    name: "Skills",
    hash: "#skills",
  },
  {
    name: "Experience",
    hash: "#experience",
  },
  {
    name: "Contact",
    hash: "#contact",
  },
] as const;

export const experiencesData = [
  {
    title: "Graduated University of California, Santa ",
    location: "Santa Cruz, CA",
    description:
      "I graduated while being a regular participant of the Slug Security (Cybersecurity) club.",
    icon: React.createElement(LuGraduationCap),
    date: "June 2023",
  },
  {
    title: "Software Developer Intern",
    location: "San Jose, CA",
    description:
      "Using Python frameworks like Django and Pandas, implementing validation mechanisms to reduce bugs, and conducting testing to optimize performance.",
    icon: React.createElement(FaPython),
    date: "Spetember 2023 - Present",
  },
  {
    title: "Cybersecurity Analyst Intern",
    location: "Fremont, CA",
    description:
      "Conducted fit-gap analyses, adhered to industry best practices for secure infrastructure, and created reports on vulnerabilities with recommended remediation strategies",
    icon: React.createElement(BsShieldLock),
    date: "December 2023 - present",
  },
] as const;

export const projectsData = [
  {
    title: "CorpComment",
    description:
      "I worked as a full-stack developer on this startup project for 2 years. Users can give public feedback to companies.",
    tags: ["React", "Next.js", "MongoDB", "Tailwind", "Prisma"],
    imageUrl: corpcommentImg,
  },
  {
    title: "rmtDev",
    description:
      "Job board for remote developer jobs. I was the front-end developer. It has features like filtering, sorting and pagination.",
    tags: ["React", "TypeScript", "Next.js", "Tailwind", "Redux"],
    imageUrl: rmtdevImg,
  },
  {
    title: "Word Analytics",
    description:
      "A public web app for quick analytics on text. It shows word count, character count and social media post limits.",
    tags: ["React", "Next.js", "SQL", "Tailwind", "Framer"],
    imageUrl: wordanalyticsImg,
  },
] as const;

export const skillsData = [
  "Python",
  "MongoDB",
  "PostgreSQL",
  "HTML",
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Git",
  "Tailwind",
  "Prisma",
  "Django",
  "Framer Motion",
] as const;
