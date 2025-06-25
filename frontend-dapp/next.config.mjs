/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'brown-able-echidna-470.mypinata.cloud',
        port: '',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        port: '',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co', // Aggiunto per l'immagine di fallback
        port: '',
        pathname: '/**',
      },
    ],
    // Abilita il caricamento di SVG. Usa con cautela in produzione per motivi di sicurezza (XSS).
    dangerouslyAllowSVG: true,
    // Permette di specificare il tipo di disposizione del contenuto (es. 'attachment' per il download).
    // Potrebbe essere utile per i tuoi PDF se Next.js avesse problemi a servirli direttamente.
    contentDispositionType: 'attachment',
    // Politica di sicurezza del contenuto per le immagini.
    // Questa è una misura di sicurezza aggiuntiva per prevenire attacchi XSS.
    // Significa che le immagini possono essere caricate solo dalla stessa origine ('self')
    // e che gli script sono disabilitati. Il sandbox rafforza ulteriormente la sicurezza.
    // Potresti volerla rimuovere o modificarla se hai problemi a caricare immagini da altre fonti.
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;

