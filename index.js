const { DisconnectReason, makeWASocket, useMultiFileAuthState, makeInMemoryStore } = require('@whiskeysockets/baileys');
const { analyzeMessage } = require('./nlp-module.js'); // Simpan modul NLP terpisah jika diperlukan

const store = makeInMemoryStore({});
const processedMessages = new Set(); // Untuk menyimpan ID pesan yang sudah diproses
const usersWhoReceivedWelcome = new Set(); // Menyimpan pengguna yang sudah menerima pesan selamat datang

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

        // Abaikan jika pesan dari diri sendiri atau sudah diproses
        if (message.key.fromMe || processedMessages.has(messageId)) return;

        processedMessages.add(messageId); // Tandai pesan sebagai diproses

        console.log('New message:', JSON.stringify(message, null, 2));

        const remoteJid = message.key.remoteJid;

        // Fitur 1: Pesan Selamat Datang
        if (!remoteJid.endsWith('@g.us') && !usersWhoReceivedWelcome.has(remoteJid)) { // Pastikan ini adalah chat pribadi dan belum menerima pesan selamat datang
            const welcomeMessage = `Halo! Selamat datang di chatbot kami. Karena Bot Sedang dalam tahap pengembangan jika ada keperluan penting Silakan pilih Hubungi Admin:
1. Info Produk
2. Bantuan
3. Hubungi Admin`;
            try {
                await sock.sendMessage(remoteJid, { text: welcomeMessage });
                usersWhoReceivedWelcome.add(remoteJid); // Tandai pengguna sudah menerima pesan selamat datang
                console.log('Pesan selamat datang dikirim.');
            } catch (error) {
                console.error('Gagal mengirim pesan selamat datang:', error);
            }
            return; // Hentikan eksekusi setelah pesan selamat datang
        }


        if (text === '1' || text.toLowerCase() === 'Info Produk') {
            console.log('Pengguna memilih menu admin...');
            try {
                await sock.sendMessage(remoteJid, { text: 'Maaf saat ini belum ada produk yang tersedia. Jika ada pertanyaan lebih lanjut anda dapat menghubungi admin di nomor ini: 085767496725.' });
                console.log('Respon ke menu admin dikirim.');
            } catch (error) {
                console.error('Gagal mengirim respon ke menu admin:', error);
            }
            return; // Hentikan eksekusi lebih lanjut
        }

        if (text ==='2' || text.toLowerCase() === 'Bantuan') {
            console.log('Pengguna memilih menu Bantuan...');
            try {
                await sock.sendMessage(remoteJid, { text: 'Anda telah memilih untuk Bantuan. Anda dapat menghubungi admin di nomor ini: 085767496725.' });
                console.log('Respon ke menu admin dikirim.');
            } catch (error) {
                console.error('Gagal mengirim respon ke menu admin:', error);
            }
            return;
        }
        if (text === '3' || text.toLowerCase() === 'Hubungi Admin') {
            console.log('Pengguna memilih menu admin...');
            try {
                await sock.sendMessage(remoteJid, { text: 'Anda telah memilih untuk menghubungi admin. Anda dapat menghubungi admin di nomor ini: 085767496725.' });
                console.log('Respon ke menu admin dikirim.');
            } catch (error) {
                console.error('Gagal mengirim respon ke menu admin:', error);
            }
            return; // Hentikan eksekusi lebih lanjut
        }

        // Analisis Pesan dan Respons Cerdas (NLP)
        try {
            const analysisResult = analyzeMessage(text); // Memperbaiki analisis pesan agar berbasis teks yang diterima
            console.log('Analysis result:', analysisResult);

            // Langsung merespon sesuai intent
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
