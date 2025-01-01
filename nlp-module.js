const analyzeMessage = (message) => {
    // Contoh implementasi analisis pesan
    if (message.includes('info produk')) {
        return 'Tentu! Berikut adalah info produk kami...';
    } else if (message.includes('bantuan')) {
        return 'Silakan sebutkan masalah Anda. Kami siap membantu!';
    } else if (message.includes('admin')) {
        return 'Hubungi admin kami di nomor 08123456789.';
    } else {
        return 'Maaf, saya tidak mengerti. Bisa dijelaskan lebih lanjut?';
    }
};

module.exports = { analyzeMessage };
