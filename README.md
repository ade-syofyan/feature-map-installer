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
Alpine/musl dan Mac Intel belum didukung. Windows memakai tar bawaan Windows 10/11. Node 18.20.8+, tar, Git, serta Python 3
untuk hook/core Free diperlukan. Installer memasang skill Codex; `--activate-only`
mengaktifkan tanpa memasang skill. Plugin Claude Code dapat dipasang manual dari
folder paket melalui pengelola plugin, dengan satu sumber feature-map aktif.

Aktivasi memerlukan email pembelian dan kode lisensi yang sesuai.
Instalasi lama disalin ke folder backup di luar folder skills. Core Free tetap MIT.
Untuk pembelian dan bantuan aktivasi, hubungi ade.syofyan@gmail.com.


Versi 0.22.0-pro.1 menambahkan Riwayat Aturan, Bekal Tugas dan Lanjut Tugas.
Agent membaca aturan sebelum edit dan memeriksa kembali kebijakan/bukti usang
ketika melanjutkan tugas. Review tetap wajib; laporan bukan pengunci editor atau
jaminan semua konflik kebijakan terdeteksi. Jalankan command --help untuk opsi.

Untuk memperbarui dari versi sebelum 0.23, hubungi penerbit terlebih dahulu
untuk mendapatkan kode lisensi yang sesuai. Jangan bagikan kode lisensi Anda.
