<p align="center"><img src="assets/brand/feature-map.png" width="112" alt="Feature Map" /></p>

# Feature Map Pro Installer

Installer gratis untuk Feature Map Pro. Fitur premium memerlukan lisensi per email.
Source mesin Pro tidak termasuk dalam paket npm; binary diunduh dari rilis resmi.

```bash
npx @ade-syofyan/feature-map-pro@latest install
```

Masukkan email pembelian dan kode lisensi dari Ade Syofyan. Saat mengetik atau paste,
kode disamarkan dengan titik dan jumlah karakter. Tekan Enter untuk memeriksa lisensi;
Ctrl+U menghapus input dan Ctrl+C membatalkan. Anda juga bisa memakai
`--license-file /path/to/buyer.license`. Jangan memasukkan kode ke argumen command.
Setelah aktif, buka sesi agent baru. Status: `npx @ade-syofyan/feature-map-pro@latest license status`.

Platform yang tersedia tercantum di release.json: macOS Apple Silicon, Windows x64,
dan Linux x64 (glibc, Ubuntu 22.04 atau lebih baru). Windows ARM, Linux ARM dan
Alpine/musl dan Mac Intel belum didukung. Windows memakai tar bawaan Windows 10/11. Node 20+, tar, Git, serta Python 3
untuk hook/core Free diperlukan. Installer memasang skill Codex; `--activate-only`
mengaktifkan tanpa memasang skill. Plugin Claude Code dapat dipasang manual dari
folder paket melalui pengelola plugin, dengan satu sumber feature-map aktif.

Lisensi diverifikasi offline sebelum instalasi skill dan setiap command premium.
Instalasi lama disalin ke folder backup di luar folder skills. Core Free tetap MIT.
Kompilasi mempersulit pembacaan source; bukan jaminan anti-reverse-engineering
atau pencegahan penyalinan binary. Pembelian/harga: ade.syofyan@gmail.com.


Versi 0.22.0-pro.1 menambahkan Riwayat Aturan, Bekal Tugas dan Lanjut Tugas.
Agent membaca aturan sebelum edit dan memeriksa kembali kebijakan/bukti usang
ketika melanjutkan tugas. Review tetap wajib; laporan bukan pengunci editor atau
jaminan semua konflik kebijakan terdeteksi. Jalankan command --help untuk opsi.

Versi 0.23.0-pro.1 memakai lisensi FMP2. Kode lisensi tidak memuat email asli;
email dimasukkan terpisah dan diperiksa dengan Argon2id serta tanda tangan Ed25519.
FMP1 tidak diterima. Minta penerbitan ulang lewat operator sebelum memperbarui.
Email yang sudah diketahui masih bisa dicoba secara offline; format ini tidak
menjamin email mustahil ditebak. Binary lama tetap menerima FMP1 sampai diperbarui.
