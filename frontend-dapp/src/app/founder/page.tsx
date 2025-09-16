// frontend-dapp/src/app/founder/page.tsx
"use client"; // Mantieni il "use client" perché il componente usa useState, Framer Motion, ecc.

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { Tooltip } from "react-tooltip";

// Import Icone
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

// Tipi per i dati (invariati)
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

// ========================================
// IMPORTANTE: METADATA SONO STATI SPOSTATI IN founder/layout.tsx
// Rimosso: export const metadata: Metadata = { ... }
// ========================================

export default function FounderProfilePage() {
  const [activeModal, setActiveModal] = useState<string | null>(null);

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
      image: "/img/itis_belpasso.jpg", // Aggiornato con percorso reale
    },
    {
      id: 2,
      period: "2001 - 2006",
      institution: "Facoltà Ingegneria Catania",
      title: "Ingegnere delle TLC",
      description:
        "Votazione: 108/110. Discipline: Analisi, Teoria dei segnali, Reti, Sistemi di TLC.",
      image: "/img/unict.jpg", // Aggiornato con percorso reale
    },
    {
      id: 3,
      period: "Stage Universitario",
      institution: "SELEX ELSAG",
      title: "Simulazione Reti Tattiche",
      description:
        "Simulazione architetturale di reti tattiche con System Architect e OPNET Modeler.",
      image: "/img/selex_elsag.jpg", // ho ripristinato questo se hai l'immagine, altrimenti usa /img/education.jpg
    },
  ];

  const projects: Project[] = [
    {
      id: 1,
      title: "Coinmarketcap Report Bot",
      description: "Bot per analisi quotidiana crypto con archiviazione JSON.",
      githubUrl: "https://github.com/antopat1/coinmarketcap_bot",
      image: "/img/report_chatbot.jpg", // Aggiornato con percorso reale
      technologies: ["Python", "API", "JSON"],
    },
    {
      id: 2,
      title: "Notarizzazione News su Blockchain",
      description:
        "Sistema Django per certificare articoli su testnet Ethereum.",
      githubUrl: "https://github.com/antopat1/ProgettoDJangoDiAntoninoPaterno2",
      image: "/img/notarizzazione_news.jpg", // Aggiornato con percorso reale
      technologies: ["Django", "Blockchain", "Ethereum"],
    },
    {
      id: 3,
      title: "Piattaforma Scambio BTC",
      description:
        "Piattaforma trading Bitcoin con MongoDB e API CoinMarketCap.",
      githubUrl: "https://github.com/antopat1/ProgettoMongoDBdiAntoninoPaterno",
      image: "/img/BTC-Exchange.jpg", // Aggiornato con percorso reale
      technologies: ["Django", "MongoDB", "API"],
    },
    {
      id: 4,
      title: "ERC20 Piggy Bank Smart Contract",
      description:
        "Smart Contract ERC20 con interfaccia Web3.py per Ganache/Goerli.",
      githubUrl:
        "https://github.com/antopat1/ProgettoEthereumWeb3diAntoninoPaterno",
      image: "/img/MoneyBox.png", // Aggiornato con percorso reale
      technologies: ["Solidity", "Web3.py", "ERC20"],
    },
    {
      id: 5,
      title: "Personal Website Portfolio",
      description:
        "Sito portfolio personale realizzato con Bootstrap HTML/CSS.",
      githubUrl: "https://github.com/antopat1/antopat1-My_personal_website",
      image: "/img/myimg.jpg", // Aggiornato con percorso reale
      technologies: ["HTML", "CSS", "Bootstrap"],
    },
    {
      id: 6,
      title: "PDF Data Extraction Script",
      description:
        "Script Python per acquisizione dati da PDF, elaborazione XML e salvataggio in CSV.",
      githubUrl: "https://github.com/antopat1/acquireDataFromPDFandSaveToCSV",
      image: "/img/pdf_extraction.jpg", // Aggiornato con percorso reale
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
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Tooltip id="tech-tooltip" />

      {/* ======================================== */}
      {/* HERO SECTION - TESTO CENTRATO            */}
      {/* ======================================== */}
      <section
        className="relative h-[45vh] overflow-hidden 
             bg-hero-background bg-cover bg-no-repeat bg-left-center"
      >
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
                className="text-gray-400 hover:text-white transition-colors"
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

      {/* ======================================== */}
      {/* SEZIONE ABOUT ME & SKILLS                */}
      {/* ======================================== */}
      <section className="py-20 px-4 bg-gray-600/50" id="about">
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
            <p className="text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Conclusi gli studi in Ingegneria e dopo 14 anni di esperienza
              nelle settore delle TLC prima come consulente presso operatori ISP
              in qualità di analista tecnico di reportistica e monitoraggio
              traffico dati su diversi Time Frame, poi come Project Manager e
              Controller contabile nei cantieri di realizzazione rete di accesso
              FTTH progetto BUL, ho deciso a seguito di una profonda riflessione
              personale e professionale post COVID, di alimentare le mie
              passioni nel campo delle tecnologie informatiche, registri
              ditribuiti e sistemi/processi economici decentralizzati basati su
              Blockchain. L'opportunità di lavorare presso Istituti comprensivi
              di scuola secondaria di primo grado in qualità di Assistente
              Tecnico informatico e docente corsi di Coding e Robotica,
              rappresenta per me oggi una combinazione perfetta per conciliare
              lavoro e studio personale grazie al percorso proposto da{" "}
              <a
                href="https://www.start2impact.it/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 font-semibold hover:underline"
              >
                Start2impact University
              </a>
              .
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
            {/* Hard Skills */}
            <motion.div
              className="space-y-4"
              initial={{ x: -100, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <h3 className="text-2xl font-bold text-center lg:text-left mb-6">
                HARD SKILLS
              </h3>
              {hardSkills.map((skill) => (
                <div key={skill.name}>
                  <p className="text-sm font-medium text-gray-300 mb-1">
                    {skill.name}
                  </p>
                  <div className="bg-gray-700 rounded-full h-4">
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

            {/* Image - Aggiornato con percorso reale */}
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.5, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <img
                src="/img/myimg.jpg" // Percorso aggiornato
                alt="Antonio Paternò"
                className="rounded-full w-64 h-64 md:w-80 md:h-80 object-cover border-4 border-purple-500 shadow-lg"
              />
            </motion.div>

            {/* Soft Skills */}
            <motion.div
              className="space-y-4"
              initial={{ x: 100, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <h3 className="text-2xl font-bold text-center lg:text-left mb-6">
                SOFT SKILLS
              </h3>
              {softSkills.map((skill) => (
                <div
                  key={skill.name}
                  className="flex items-center bg-gray-700 p-3 rounded-lg"
                >
                  <skill.icon className="text-2xl text-blue-400 mr-4" />
                  <span className="text-lg text-gray-200">{skill.name}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ======================================== */}
      {/* MARQUEE DELLE SKILLS - CON TOOLTIP      */}
      {/* ======================================== */}
      <section className="py-12 bg-gray-900 overflow-hidden">
        <h2 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
          COMPUTER SKILLS
        </h2>
        <div className="relative w-full flex overflow-hidden">
          <motion.div
            className="flex"
            animate={{
              x: ["0%", "-100%"],
              transition: {
                ease: "linear",
                duration: 40,
                repeat: Infinity,
              },
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
                <tech.icon className="text-6xl text-gray-500 hover:text-white transition-colors" />
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ======================================== */}
      {/* SEZIONE CARD E MODALI (INVARIATA)      */}
      {/* ======================================== */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            Esplora il mio percorso
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              className="bg-gray-800 rounded-xl p-8 cursor-pointer transform transition-all hover:scale-105 hover:bg-gray-700"
              onClick={() => setActiveModal("education")}
              whileHover={{ y: -10 }}
            >
              <FaGraduationCap className="text-5xl text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Formazione</h3>
              <p className="text-gray-400">
                Percorso accademico dall'ITIS all'Università, con
                specializzazione in Telecomunicazioni.
              </p>
            </motion.div>
            <motion.div
              className="bg-gray-800 rounded-xl p-8 cursor-pointer transform transition-all hover:scale-105 hover:bg-gray-700"
              onClick={() => setActiveModal("experience")}
              whileHover={{ y: -10 }}
            >
              <FaBuilding className="text-5xl text-green-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Esperienza</h3>
              <p className="text-gray-400">
                Oltre 15 anni nel settore TLC, con competenze in reti FTTH e
                project management.
              </p>
            </motion.div>
            <motion.div
              className="bg-gray-800 rounded-xl p-8 cursor-pointer transform transition-all hover:scale-105 hover:bg-gray-700"
              onClick={() => setActiveModal("projects")}
              whileHover={{ y: -10 }}
            >
              <FaLaptopCode className="text-5xl text-purple-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Progetti</h3>
              <p className="text-gray-400">
                Portfolio di progetti blockchain, smart contracts, e sistemi
                decentralizzati.
              </p>
            </motion.div>
          </div>

          <div className="text-center mt-16">
            <motion.a
              href="/pdf/Curriculum Paternò .pdf" // Percorso aggiornato per il PDF
              download="Curriculum_Antonio_Paterno.pdf"
              className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-full transition-colors shadow-lg text-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <BiDownload className="mr-3 text-xl" />
              Scarica il Curriculum PDF
            </motion.a>
          </div>
        </div>
      </section>

      {/* Modali (invariate) */}
      <AnimatePresence>
        {activeModal === "experience" && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gray-800 rounded-xl p-8 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Esperienze Professionali</h2>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <BiX className="text-3xl" />
                </button>
              </div>
              <div className="space-y-6">
                {experiences.map((exp, index) => (
                  <motion.div
                    key={exp.id}
                    className="bg-gray-700 rounded-lg p-6"
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-blue-400">
                          {exp.role}
                        </h3>
                        <p className="text-gray-300">{exp.company}</p>
                      </div>
                      <span className="text-sm bg-purple-600 px-3 py-1 rounded-full mt-2 md:mt-0">
                        {exp.period}
                      </span>
                    </div>
                    <p className="text-gray-300 leading-relaxed">
                      {exp.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === "education" && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gray-800 rounded-xl p-8 max-w-6xl w-full max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Percorso di Formazione</h2>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <BiX className="text-3xl" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {education.map((edu, index) => (
                  <motion.div
                    key={edu.id}
                    className="bg-gray-700 rounded-lg overflow-hidden"
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <img
                      src={edu.image} // Utilizza il percorso dell'immagine definito nell'array education
                      alt={edu.institution}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-blue-400 mb-2">
                        {edu.title}
                      </h3>
                      <p className="text-purple-400 mb-2">{edu.institution}</p>
                      <p className="text-sm text-gray-400 mb-3">{edu.period}</p>
                      <p className="text-gray-300 text-sm">{edu.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === "projects" && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gray-800 rounded-xl p-8 max-w-7xl w-full max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Portfolio Progetti</h2>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <BiX className="text-3xl" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    className="bg-gray-700 rounded-lg overflow-hidden group"
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="relative">
                      <img
                        src={project.image} // Utilizza il percorso dell'immagine definito nell'array projects
                        alt={project.title}
                        className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-blue-400 mb-3">
                        {project.title}
                      </h3>
                      <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                        {project.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {project.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="bg-gray-600 text-xs px-2 py-1 rounded"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                      >
                        <BiCode className="mr-2" />
                        Vedi su GitHub
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
