// frontend-dapp/src/utils/ipfs.ts


const PINATA_GATEWAY_SUBDOMAIN = process.env.NEXT_PUBLIC_PINATA_GATEWAY_SUBDOMAIN;

const IPFS_GATEWAY_BASE_URL = PINATA_GATEWAY_SUBDOMAIN
  ? `https://${PINATA_GATEWAY_SUBDOMAIN}.mypinata.cloud/ipfs/`
  : 'https://gateway.pinata.cloud/ipfs/'; 


/**
 * @param ipfsUri 
 * @returns 
 */
export function resolveIpfsLink(ipfsUri: string | undefined | null): string {
  if (!ipfsUri) {
    return '';
  }

  if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
    return ipfsUri;
  }


  let ipfsHash = ipfsUri;
  if (ipfsHash.startsWith('ipfs://')) {
    ipfsHash = ipfsHash.substring(7); 
  }

 
  return `${IPFS_GATEWAY_BASE_URL}${ipfsHash}`;
}

