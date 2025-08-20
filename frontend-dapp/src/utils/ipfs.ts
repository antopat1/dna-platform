// frontend-dapp/src/utils/ipfs.ts

// Utilizziamo la variabile d'ambiente per il subdomain Pinata.
// È essenziale che questa variabile sia accessibile dal client, quindi deve iniziare con NEXT_PUBLIC_
const PINATA_GATEWAY_SUBDOMAIN = process.env.NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN;

// Costruiamo il BASE_URL del gateway Pinata usando il subdomain.
// Forniamo un fallback generico nel caso la variabile non sia impostata,
// ma l'obiettivo è che usi sempre Pinata.
const IPFS_GATEWAY_BASE_URL = PINATA_GATEWAY_SUBDOMAIN
  ? `https://${PINATA_GATEWAY_SUBDOMAIN}.mypinata.cloud/ipfs/`
  : 'https://gateway.pinata.cloud/ipfs/'; // Gateway pubblico di fallback se non configurato


/**
 * Converte un URI IPFS (es. "ipfs://Qm...") o un hash IPFS (es. "Qm...")
 * in un URL HTTP accessibile tramite il gateway Pinata configurato.
 *
 * @param ipfsUri L'URI IPFS o l'hash IPFS.
 * @returns L'URL HTTP risolto, o una stringa vuota se l'input non è valido.
 */
export function resolveIpfsLink(ipfsUri: string | undefined | null): string {
  if (!ipfsUri) {
    return '';
  }

  // Se l'URI inizia già con http/https, lo restituisce così com'è (utile per URL già pronti)
  if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
    return ipfsUri;
  }

  // Rimuove il prefisso "ipfs://" se presente, in modo che rimanga solo l'hash CID
  let ipfsHash = ipfsUri;
  if (ipfsHash.startsWith('ipfs://')) {
    ipfsHash = ipfsHash.substring(7); // Rimuove "ipfs://"
  }

  // Costruisce l'URL completo usando il gateway configurato e l'hash CID
  return `${IPFS_GATEWAY_BASE_URL}${ipfsHash}`;
}

