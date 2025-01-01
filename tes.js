const { DisconnectReason, makeWASocket, useMultiFileAuthState, makeInMemoryStore } = require('@whiskeysockets/baileys');
const { analyzeMessage } = require('./nlp-module.js'); // Simpan modul NLP terpisah jika diperlukan

const store = makeInMemoryStore({});
const processedMessages = new Set(); // Untuk menyimpan ID pesan yang sudah diproses

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state
    });

    // Hubungkan store ke socket
    store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('opened connection');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        const messageId = message.key.id; // ID pesan unik
        const text = message.message?.conversation || '';

        // Analisis pesan menggunakan NLP
        const response = analyzeMessage(text);

        // Kirim respons ke pengguna
        if (response) {
        await sock.sendMessage(message.key.remoteJid, { text: response });

        // Abaikan jika pesan dari diri sendiri atau sudah diproses
        if (message.key.fromMe || processedMessages.has(messageId)) return;

        processedMessages.add(messageId); // Tandai pesan sebagai diproses

        console.log('New message:', JSON.stringify(message, null, 2));

        const remoteJid = message.key.remoteJid;

        // Fitur 1: Pesan Selamat Datang
        if (!remoteJid.endsWith('@g.us')) { // Pastikan ini adalah chat pribadi
            const welcomeMessage = Halo! Selamat datang di chatbot kami. Karena Bot Sedang dalam tahap pengembangan jika ada keperluan penting Silakan pilih Hubungi Admin:
1. Info Produk
2. Bantuan
3. Hubungi Admin;
            try {
                await sock.sendMessage(remoteJid, { text: welcomeMessage });
                console.log('Pesan selamat datang dikirim.');
            } catch (error) {
                console.error('Gagal mengirim pesan selamat datang:', error);
            }
            return; // Hentikan eksekusi setelah pesan selamat datang
        }

        // Fitur 2: Respon hanya jika ditandai dalam grup
        if (remoteJid.endsWith('@g.us')) {
            const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.includes(sock.user.id)) {
                console.log('Bot ditandai di grup, merespon...');
                try {
                    await sock.sendMessage(remoteJid, { text: 'Halo! Anda memanggil saya di grup. Ada yang bisa saya bantu?' });
                    console.log('Respon ke tag di grup dikirim.');
                } catch (error) {
                    console.error('Gagal mengirim respon ke grup:', error);
                }
            } else {
                console.log('Pesan dari grup, tapi bot tidak ditandai.');
            }
            return;
        }

        // Fitur 3: Analisis Pesan dan Respons Cerdas (NLP)
        try {
            const analysisResult = analyzeMessage(message);
            if (analysisResult.intent === 'product_info') {
                await sock.sendMessage(remoteJid, { text: 'Berikut adalah informasi produk kami: [Link Produk]' });
            } else if (analysisResult.intent === 'help') {
                await sock.sendMessage(remoteJid, { text: 'Bagaimana saya dapat membantu Anda hari ini?' });
            } else if (analysisResult.intent === 'contact_admin') {
                await sock.sendMessage(remoteJid, { text: 'Anda dapat menghubungi admin di nomor ini: 085767496725.' });
            } else {
                await sock.sendMessage(remoteJid, { text: 'Maaf, saya tidak memahami permintaan Anda. Silakan coba lagi.' });
            }
        } catch (error) {
            console.error('Gagal menganalisis pesan:', error);
        }
    });
}

// Jalankan fungsi utama
connectToWhatsApp();