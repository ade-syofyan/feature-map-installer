# Feature Map Pro Installer

Installer gratis untuk Feature Map Pro. Fitur premium memerlukan lisensi per email.
Source mesin Pro tidak termasuk dalam paket npm; binary diunduh dari rilis resmi.

```bash
npx @ade-syofyan/feature-map-pro@preview install
```

Masukkan email pembelian dan kode lisensi dari Ade Syofyan. Anda juga bisa memakai
`--license-file /path/to/buyer.license`. Jangan memasukkan kode ke argumen command.
Setelah aktif, buka sesi agent baru. Status: `npx @ade-syofyan/feature-map-pro@preview license status`.

Platform yang tersedia tercantum di release.json: macOS Apple Silicon, Windows x64,
dan Linux x64 (glibc, Ubuntu 22.04 atau lebih baru). Windows ARM, Linux ARM dan
Alpine/musl belum didukung. Windows memakai tar bawaan Windows 10/11. Node 20+, tar, Git, serta Python 3
untuk hook/core Free diperlukan. Installer memasang skill Codex; `--activate-only`
mengaktifkan tanpa memasang skill. Plugin Claude Code dapat dipasang manual dari
folder paket melalui pengelola plugin, dengan satu sumber feature-map aktif.

Lisensi diverifikasi offline sebelum instalasi skill dan setiap command premium.
Instalasi lama disalin ke folder backup di luar folder skills. Core Free tetap MIT.
Kompilasi mempersulit pembacaan source; bukan jaminan anti-reverse-engineering
atau pencegahan penyalinan binary. Pembelian/harga: ade.syofyan@gmail.com.
