// getEventTopicHash.js
const path = require("path");
const fs = require("fs");
const { keccak256, toEventSelector } = require('viem'); // Importa le funzioni necessarie da viem

async function main() {
    // Percorso al file JSON dell'ABI del ScientificContentRegistry.sol
    const abiPath = path.resolve(__dirname, 'artifacts', 'contracts', 'ScientificContentRegistry.sol', 'ScientificContentRegistry.json');

    try {
        // Leggi il contenuto del file JSON
        const rawAbi = fs.readFileSync(abiPath, 'utf8');
        const contractJson = JSON.parse(rawAbi);
        const registryABI = contractJson.abi;

        // Trova la definizione dell'evento "ContentRegistered" nell'ABI
        // in un formato compatibile con viem, che è molto simile a Ethers
        const eventAbi = registryABI.find(item => item.type === 'event' && item.name === 'ContentRegistered');

        if (eventAbi) {
            // Viem ha bisogno della "firma" dell'evento per calcolare il selector/topic.
            // La firma è del tipo "EventName(type1,type2,...)"
            // Costruiamo la firma canonica dell'evento.
            // Nota: Viem (e Ethers) si basano sui tipi dei parametri, non sui nomi.
            // Parametri `indexed` non cambiano la firma per il calcolo del selector.

            const paramTypes = eventAbi.inputs.map(input => input.internalType || input.type).join(',');
            const eventSignature = `${eventAbi.name}(${paramTypes})`;

            // Calcola il topic hash (selector) dell'evento usando keccak256 sulla firma dell'evento
            const topicHash = keccak256(toEventSelector(eventSignature));

            console.log("------------------------------------------------------------------");
            console.log("   Nuovo HASH per l'evento 'ContentRegistered' (usando Viem):");
            console.log(`   Event Signature: "${eventSignature}"`);
            console.log(`   Topic Hash:      ${topicHash}`);
            console.log("------------------------------------------------------------------");
            console.log("\nAssicurati di aggiornare 'CONTENT_REGISTERED_EVENT_TOPIC' nel tuo frontend.");

        } else {
            console.error("Errore: Evento 'ContentRegistered' non trovato nell'ABI. Controlla il nome dell'evento o che l'ABI sia aggiornato.");
        }
    } catch (error) {
        console.error("Errore durante la lettura o l'elaborazione dell'ABI:", error);
        console.error("Assicurati di aver compilato il tuo contratto e che il percorso dell'ABI sia corretto:", abiPath);
    }
}

// Esegui la funzione main
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });