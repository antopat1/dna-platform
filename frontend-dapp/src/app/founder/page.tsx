// frontend-dapp/src/app/founder/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { Tooltip } from "react-tooltip";
import { BiDownload, BiX, BiCode } from "react-icons/bi";
import {
  FaGraduationCap,
  FaBuilding,
  FaLaptopCode,
  FaGithub,
  FaLinkedin,
  FaFacebook,
  FaHtml5,
  FaCss3Alt,
  FaPython,
  FaBootstrap,
  FaGitAlt,
  FaJsSquare,
  FaUsers,
  FaListUl,
  FaDumbbell,
  FaBrain,
  FaBullhorn,
  FaReact,
} from "react-icons/fa";
import {
  SiDjango,
  SiMongodb,
  SiSolidity,
  SiRedis,
  SiNextdotjs,
  SiTypescript,
  SiTailwindcss,
} from "react-icons/si";
import { ArrowRight, Github } from "lucide-react";

// Tipi (invariati)
interface Experience {
  id: number;
  period: string;
  company: string;
  role: string;
  description: string;
}
interface Education {
  id: number;
  period: string;
  institution: string;
  title: string;
  description: string;
  image: string;
}
interface Project {
  id: number;
  title: string;
  description: string;
  githubUrl: string;
  image: string;
  technologies: string[];
}

export default function FounderProfilePage() {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const handleGithubClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(
      "https://github.com/antopat1/dna-platform",
      "_blank",
      "noopener,noreferrer"
    );
  };

  const experiences: Experience[] = [
    {
      id: 0,
      period: "01/09/2025 – Attualmente",
      company: "Istituto agrario Gaetano Cantoni di Treviglio",
      role: "Assistente tecnico e amministratore di Rete I.S.I.S.S.",
      description:
        "Attività di supporto tecnico, manutenzione, gestione e amministrazione della rete informatica e dei sistemi dell'istituto, garantendo efficienza e sicurezza.",
    },
    {
      id: 1,
      period: "16/09/2021 – 31/08/2025",
      company: "IC Calusco D'Adda",
      role: "Assistente Tecnico e Docente Corsi Robotica & Coding",
      description:
        "Attività di supporto tecnico, manutenzione, formazione docenti ed alunni sui sistemi informatici scolastici e didattica ludica.",
    },
    {
      id: 2,
      period: "Marzo 2020 – Settembre 2021",
      company: "SIELTE S.P.A. c/o Open Fiber",
      role: "Project Manager – Open Fiber Cluster C&D",
      description:
        "Analisi Computi Metrici, gestione progetti civili, coordinamento squadre per reti FTTH e siti PCN/FWA/BH.",
    },
    {
      id: 3,
      period: "Settembre 2013 – Febbraio 2020",
      company: "Sielte S.p.A. c/o Metroweb Milano",
      role: "Assistente Tecnico di Rete FTTH",
      description:
        "Gestione e coordinamento tecnico squadre per Horizontal Network creation rete FTTH GPON, controllo cantieri e gestione guasti.",
    },
    {
      id: 4,
      period: "Dicembre 2007 – Aprile 2013",
      company: "Sielte S.p.A. c/o Wind S.p.A.",
      role: "Consulente TLC Data Analyst",
      description:
        "Analista tecnico di reportistica e monitoraggio traffico real-time dei parametri QoS su diverse reti (IP, ACCESS, MAN, CORE).",
    },
    {
      id: 5,
      period: "Settembre 2007 – Dicembre 2007",
      company: "La Rinascente S.p.A.",
      role: "Stagista",
      description:
        "Amministrazione e sicurezza rete aziendale, Help-Desk, installazione e configurazione Router WiFi.",
    },
  ];
  const education: Education[] = [
    {
      id: 1,
      period: "1996 - 2001",
      institution: "ITIS G. Ferraris",
      title: "Perito Elettronico e TLC",
      description: "Votazione: 95/100",
      image: "/img/itis_belpasso.jpg",
    },
    {
      id: 2,
      period: "2001 - 2006",
      institution: "Facoltà Ingegneria Catania",
      title: "Ingegnere delle TLC",
      description:
        "Votazione: 108/110. Discipline: Analisi, Teoria dei segnali, Reti, Sistemi di TLC.",
      image: "/img/unict.jpg",
    },
    {
      id: 3,
      period: "Stage Universitario",
      institution: "SELEX ELSAG",
      title: "Simulazione Reti Tattiche",
      description:
        "Simulazione architetturale di reti tattiche con System Architect e OPNET Modeler.",
      image: "/img/selex_elsag.jpg",
    },
  ];
  const projects: Project[] = [
    {
      id: 1,
      title: "Coinmarketcap Report Bot",
      description: "Bot per analisi quotidiana crypto con archiviazione JSON.",
      githubUrl: "https://github.com/antopat1/coinmarketcap_bot",
      image: "/img/report_chatbot.jpg",
      technologies: ["Python", "API", "JSON"],
    },
    {
      id: 2,
      title: "Notarizzazione News su Blockchain",
      description:
        "Sistema Django per certificare articoli su testnet Ethereum.",
      githubUrl: "https://github.com/antopat1/ProgettoDJangoDiAntoninoPaterno2",
      image: "/img/notarizzazione_news.jpg",
      technologies: ["Django", "Blockchain", "Ethereum"],
    },
    {
      id: 3,
      title: "Piattaforma Scambio BTC",
      description:
        "Piattaforma trading Bitcoin con MongoDB e API CoinMarketCap.",
      githubUrl: "https://github.com/antopat1/ProgettoMongoDBdiAntoninoPaterno",
      image: "/img/BTC-Exchange.jpg",
      technologies: ["Django", "MongoDB", "API"],
    },
    {
      id: 4,
      title: "ERC20 Piggy Bank Smart Contract",
      description:
        "Smart Contract ERC20 con interfaccia Web3.py per Ganache/Goerli.",
      githubUrl:
        "https://github.com/antopat1/ProgettoEthereumWeb3diAntoninoPaterno",
      image: "/img/MoneyBox.png",
      technologies: ["Solidity", "Web3.py", "ERC20"],
    },
    {
      id: 5,
      title: "Personal Website Portfolio",
      description:
        "Sito portfolio personale realizzato con Bootstrap HTML/CSS.",
      githubUrl: "https://github.com/antopat1/antopat1-My_personal_website",
      image: "/img/myimg.jpg",
      technologies: ["HTML", "CSS", "Bootstrap"],
    },
    {
      id: 6,
      title: "PDF Data Extraction Script",
      description:
        "Script Python per acquisizione dati da PDF, elaborazione XML e salvataggio in CSV.",
      githubUrl: "https://github.com/antopat1/acquireDataFromPDFandSaveToCSV",
      image: "/img/pdf_extraction.jpg",
      technologies: ["Python", "PDF", "XML", "CSV"],
    },
  ];
  const hardSkills = [
    { name: "HTML", percentage: 80, color: "bg-yellow-500" },
    { name: "CSS/Bootstrap/Tailwind", percentage: 60, color: "bg-green-500" },
    { name: "Python", percentage: 70, color: "bg-red-500" },
    { name: "Django", percentage: 60, color: "bg-blue-500" },
    { name: "React", percentage: 70, color: "bg-cyan-500" },
    { name: "Next.js", percentage: 70, color: "bg-neutral-400" },
    { name: "Mongo DB", percentage: 60, color: "bg-teal-500" },
    { name: "Solidity/Blockchain S.C.", percentage: 75, color: "bg-gray-400" },
    { name: "JavaScript/TypeScript", percentage: 70, color: "bg-indigo-500" },
  ];
  const softSkills = [
    { name: "Lavorare in team", icon: FaUsers },
    { name: "Organizzazione", icon: FaListUl },
    { name: "Adattabilità", icon: FaDumbbell },
    { name: "Problem solving", icon: FaBrain },
    { name: "Comunicazione", icon: FaBullhorn },
  ];
  const socialLinks = [
    { href: "https://github.com/antopat1", icon: FaGithub },
    { href: "https://www.facebook.com/antopat1", icon: FaFacebook },
    {
      href: "https://www.linkedin.com/in/antonino-paternò-3b526932",
      icon: FaLinkedin,
    },
  ];
  const techIcons = [
    { icon: FaHtml5, name: "HTML5" },
    { icon: FaCss3Alt, name: "CSS3" },
    { icon: FaBootstrap, name: "Bootstrap" },
    { icon: FaJsSquare, name: "JavaScript" },
    { icon: SiTypescript, name: "TypeScript" },
    { icon: FaReact, name: "React" },
    { icon: SiNextdotjs, name: "Next.js" },
    { icon: SiTailwindcss, name: "Tailwind CSS" },
    { icon: FaPython, name: "Python" },
    { icon: SiDjango, name: "Django" },
    { icon: SiMongodb, name: "MongoDB" },
    { icon: SiRedis, name: "Redis" },
    { icon: SiSolidity, name: "Solidity" },
    { icon: FaGitAlt, name: "Git" },
  ];

  return (
    <div className="min-h-screen font-sans transition-all duration-300 bg-gray-50 text-gray-800 dark:bg-slate-900 dark:text-slate-200">
      <Tooltip id="tech-tooltip" />

      <section className="relative h-[45vh] overflow-hidden bg-hero-background bg-cover bg-no-repeat bg-left-center">
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="absolute z-20 top-1/2 left-4 md:left-8 transform -translate-y-1/2">
          <motion.div
            className="flex md:flex-col gap-6"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            {socialLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <link.icon className="text-3xl" />
              </a>
            ))}
          </motion.div>
        </div>
        <div className="absolute z-10 inset-0 flex flex-col items-center justify-center text-center p-4">
          <div>
            <motion.h1
              className="text-5xl md:text-7xl font-bold mb-4 text-blue-600 drop-shadow-lg"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              Antonino Paternò
            </motion.h1>
            <div className="text-xl md:text-2xl text-gray-200 h-24 md:h-12 drop-shadow-md">
              <TypeAnimation
                sequence={[
                  "Telecommunications Engineer",
                  2000,
                  "FTTH Project Manager",
                  2000,
                  "Coding & Robotics Teacher",
                  2000,
                  "Blockchain Enthusiast & Developer",
                  2000,
                ]}
                wrapper="span"
                speed={50}
                style={{ display: "inline-block" }}
                repeat={Infinity}
              />
            </div>
          </div>
        </div>
      </section>

      <section
        className="py-20 px-4 transition-colors duration-300 bg-gray-100 dark:bg-slate-800"
        id="about"
      >
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
              ABOUT ME
            </h2>

            <p className="text-lg max-w-3xl mx-auto leading-relaxed text-gray-600 dark:text-slate-400">
              Conclusi gli studi in Ingegneria e dopo 14 anni di esperienza
              nelle settore delle TLC prima come consulente presso operatori ISP
              in qualità di analista tecnico di reportistica e monitoraggio
              traffico dati su diversi Time Frame, poi come Project Manager e
              Controller contabile nei cantieri di realizzazione rete di
              accesso FTTH progetto BUL, ho deciso a seguito di una profonda
              riflessione personale e professionale post COVID, di alimentare
              le mie passioni nel campo delle tecnologie informatiche, registri
              ditribuiti e sistemi/processi economici decentralizzati basati su
              Blockchain. L'opportunità di lavorare presso Istituti
              comprensivi di scuola secondaria di primo grado in qualità di
              Assistente Tecnico informatico e docente corsi di Coding e
              Robotica, rappresenta per me oggi una combinazione perfetta per
              conciliare lavoro e studio personale grazie al percorso proposto
              da{" "}
              <a
                href="https://www.start2impact.it/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 font-semibold hover:underline"
              >
                Start2impact University
              </a>
              .
            </p>
          </motion.div>

          <motion.div
            className="max-w-3xl mx-auto mt-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              href="/"
              className="group block p-6 rounded-xl transform transition-all duration-300 hover:scale-105 bg-white shadow-lg hover:shadow-2xl dark:bg-slate-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 pr-4">
                  <div
                    className="flex-shrink-0 mr-5 p-3 rounded-full flex items-center justify-center overflow-hidden bg-gray-100 dark:bg-slate-600"
                    style={{ width: "48px", height: "48px" }}
                  >
                    <img
                      src="/img/logo.png"
                      alt="DnA Platform Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl md:text-2xl text-gray-900 dark:text-slate-100">
                      DnA Platform
                    </h3>
                    <p className="text-sm uppercase font-semibold tracking-wide rounded-full px-2 py-0.5 mt-1 inline-block bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                      Portfolio Main Project
                    </p>
                    <p className="mt-2 text-xs md:text-sm text-gray-600 dark:text-slate-400">
                      Marketplace NFT che ho costruito per integrare tutte le
                      tecnologie apprese e semplificare meccanismi on chain
                      complessi attraverso Cifratura AES-256-GCM/PBKDF2 e Agenti
                      AI.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGithubClick}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-600 dark:hover:bg-slate-500 transition-all duration-200 hover:scale-110 group/github"
                    title="Vedi il codice su GitHub"
                    aria-label="Apri repository GitHub"
                  >
                    <Github className="w-5 h-5 text-gray-700 dark:text-slate-300 group-hover/github:text-gray-900 dark:group-hover/github:text-white transition-colors" />
                  </button>
                  <ArrowRight className="w-8 h-8 transition-transform duration-300 group-hover:translate-x-2 text-gray-400 dark:text-slate-500" />
                </div>
              </div>
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center mt-20">
            <motion.div
              className="space-y-4"
              initial={{ x: -100, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 }}
            >
              <h3 className="text-2xl font-bold text-center lg:text-left mb-6">
                HARD SKILLS
              </h3>
              {hardSkills.map((skill) => (
                <div key={skill.name}>
                  <p className="text-sm font-medium mb-1 text-gray-700 dark:text-slate-300">
                    {skill.name}
                  </p>

                  <div className="bg-gray-200 rounded-full h-4 dark:bg-slate-600">
                    <motion.div
                      className={`${skill.color} h-4 rounded-full flex items-center justify-end pr-2`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${skill.percentage}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    >
                      <span className="text-xs font-bold text-white">
                        {skill.percentage}%
                      </span>
                    </motion.div>
                  </div>
                </div>
              ))}
            </motion.div>
            <motion.div
              className="flex justify-center order-first lg:order-none"
              initial={{ scale: 0.5, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 }}
            >
              <div className="overflow-hidden rounded-xl border-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-purple-600 w-64 md:w-80 aspect-[4/5]">
                <img
                  src="/img/myimg.jpg"
                  alt="Antonino Paternò"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
            <motion.div
              className="space-y-4"
              initial={{ x: 100, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 }}
            >
              <h3 className="text-2xl font-bold text-center lg:text-left mb-6">
                SOFT SKILLS
              </h3>
              {softSkills.map((skill) => (
                <div
                  key={skill.name}
                  className="flex items-center p-3 rounded-lg bg-white shadow-sm dark:bg-slate-700"
                >
                  <skill.icon className="text-2xl text-blue-400 mr-4" />

                  <span className="text-lg text-gray-800 dark:text-slate-200">
                    {skill.name}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 overflow-hidden bg-gray-50 dark:bg-slate-900">
        <h2 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
          COMPUTER SKILLS
        </h2>
        <div className="relative w-full flex overflow-hidden">
          <motion.div
            className="flex"
            animate={{
              x: ["0%", "-100%"],
              transition: { ease: "linear", duration: 40, repeat: Infinity },
            }}
          >
            {[...techIcons, ...techIcons].map((tech, index) => (
              <div
                key={index}
                className="flex-shrink-0 mx-8 flex items-center justify-center"
                style={{ width: "100px" }}
                data-tooltip-id="tech-tooltip"
                data-tooltip-content={tech.name}
              >
                <tech.icon className="text-6xl transition-colors text-violet-700 hover:text-gray-800 dark:hover:text-slate-200" />
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            Esplora il mio percorso
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              className="rounded-xl p-8 cursor-pointer transform transition-all hover:scale-105 bg-white shadow-lg hover:shadow-xl dark:bg-slate-700"
              onClick={() => setActiveModal("education")}
              whileHover={{ y: -10 }}
            >
              <FaGraduationCap className="text-5xl text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Formazione</h3>
              <p className="text-gray-600 dark:text-slate-400">
                Percorso accademico dall'ITIS all'Università, con
                specializzazione in Telecomunicazioni.
              </p>
            </motion.div>
            <motion.div
              className="rounded-xl p-8 cursor-pointer transform transition-all hover:scale-105 bg-white shadow-lg hover:shadow-xl dark:bg-slate-700"
              onClick={() => setActiveModal("experience")}
              whileHover={{ y: -10 }}
            >
              <FaBuilding className="text-5xl text-green-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Esperienza</h3>
              <p className="text-gray-600 dark:text-slate-400">
                Oltre 15 anni nel settore TLC, con competenze in reti FTTH e
                project management.
              </p>
            </motion.div>
            <motion.div
              className="rounded-xl p-8 cursor-pointer transform transition-all hover:scale-105 bg-white shadow-lg hover:shadow-xl dark:bg-slate-700"
              onClick={() => setActiveModal("projects")}
              whileHover={{ y: -10 }}
            >
              <FaLaptopCode className="text-5xl text-purple-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Progetti</h3>
              <p className="text-gray-600 dark:text-slate-400">
                Portfolio di progetti blockchain, smart contracts, e sistemi
                decentralizzati.
              </p>
            </motion.div>
          </div>
          <div className="text-center mt-16">
            <motion.a
              href="/pdf/Curriculum Paternò .pdf"
              download="Curriculum_Antonio_Paterno.pdf"
              className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-full transition-colors shadow-lg text-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <BiDownload className="mr-3 text-xl" /> Scarica il Curriculum PDF
            </motion.a>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {activeModal && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="rounded-xl p-6 md:p-8 w-full max-h-[90vh] overflow-y-auto bg-white text-gray-800 dark:bg-slate-800 dark:text-slate-200"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              style={{
                maxWidth:
                  activeModal === "projects"
                    ? "1200px"
                    : activeModal === "education"
                    ? "1024px"
                    : "896px",
              }}
            >
              {activeModal === "experience" && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">
                      Esperienze Professionali
                    </h2>

                    <button
                      onClick={() => setActiveModal(null)}
                      className="text-gray-500 hover:text-black dark:text-slate-400 dark:hover:text-white"
                    >
                      <BiX className="text-3xl" />
                    </button>
                  </div>
                  <div className="space-y-6">
                    {experiences.map((exp, index) => (
                      <motion.div
                        key={exp.id}
                        className="rounded-lg p-6 bg-gray-100 dark:bg-slate-700"
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-blue-400">
                              {exp.role}
                            </h3>

                            <p className="text-gray-600 dark:text-slate-400">
                              {exp.company}
                            </p>
                          </div>
                          <span className="text-sm bg-purple-600 text-white px-3 py-1 rounded-full mt-2 md:mt-0 flex-shrink-0">
                            {exp.period}
                          </span>
                        </div>
                        <p className="leading-relaxed text-gray-600 dark:text-slate-400">
                          {exp.description}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
              {activeModal === "education" && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">
                      Percorso di Formazione
                    </h2>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="text-gray-500 hover:text-black dark:text-slate-400 dark:hover:text-white"
                    >
                      <BiX className="text-3xl" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {education.map((edu, index) => (
                      <motion.div
                        key={edu.id}
                        className="rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700"
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <img
                          src={edu.image}
                          alt={edu.institution}
                          className="w-full h-48 object-cover"
                        />
                        <div className="p-6">
                          <h3 className="text-xl font-bold text-blue-400 mb-2">
                            {edu.title}
                          </h3>
                          <p className="text-purple-400 mb-2">
                            {edu.institution}
                          </p>

                          <p className="text-sm mb-3 text-gray-500 dark:text-slate-400">
                            {edu.period}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-slate-300">
                            {edu.description}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
              {activeModal === "projects" && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">
                      Portfolio Progetti
                    </h2>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="text-gray-500 hover:text-black dark:text-slate-400 dark:hover:text-white"
                    >
                      <BiX className="text-3xl" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project, index) => (
                      <motion.div
                        key={project.id}
                        className="rounded-lg overflow-hidden group bg-gray-100 dark:bg-slate-700"
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="relative">
                          <img
                            src={project.image}
                            alt={project.title}
                            className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-6">
                          <h3 className="text-xl font-bold text-blue-400 mb-3">
                            {project.title}
                          </h3>

                          <p className="text-sm mb-4 leading-relaxed text-gray-600 dark:text-slate-400">
                            {project.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {project.technologies.map((tech) => (
                              <span
                                key={tech}
                                className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 dark:bg-slate-600 dark:text-slate-300"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                          <a
                            href={project.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                          >
                            <BiCode className="mr-2" /> Vedi su GitHub
                          </a>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


