# Struktur Excel dan Penjelasan Kolom

Berikut adalah struktur excel dan sheet yang ada pada file 1. PPH21 - {periode}.xlsx

## List Sheets

1. MyIntress: Berisikan List Surat Perintah Membayar yang didalamnya terdapat penyetoran pajak berupa pph21
2. Gaji Ledger: Merupakan Ledger Gaji dan Tunjangan, Spec bisa [Lihat disini](#struktur-gaji-ledger).
3. Rekap Gaji: Merupakan Pivot Tabel dan summary dari Sheet Gaji Ledger
4. Pajak: Perhitungan Pajaknya untuk specnya bisa [Lihat disini](#struktur-perhitungan-pajak)
5. Untuk Copy BPMP: Merubah Format dari Sheet Pajak untuk saya copy dan di upload ke coretax, untuk specnya bisa [Lihat disini](#struktur-copy-bpmp)
6. Non Gaji Ledger: Merupakan Ledger Uang Makan dan Honorarium, Spec bisa [Lihat disini](#struktur-sheet-non-gaji-ledger)
7. Untuk Copy BPMP Non Gaji: Merubah format dari Non Gaji Ledger menjadi format upload coretax, specnya bisa [Lihat disini](#struktur-copy-bpmp-non-gaji)
8. Ref Pegawai = List Pegawai dan komponen kepegawaian (bisa gunakan referensi file periode sebelumnya)

### Struktur Copy BPMP Non Gaji

1. Masa Pajak = Periode Bulan dalam number (contoh 2)
2. Tahun Pajak = Periode Tahun dalam number (contoh 2026)
3. NPWP = NIK pada ref Pegawai
4. ID TKU = NIK + "000000"
5. Status = Status PTKP (lihat di Pajak)
6. Fasilitas = "N/A"
7. Kode Object Pajak = 21-402-02 jika pph = 5, 21-402-04 jika pph = 0, 21-402-03 jika pph 15
8. PEnghasilan = Kotor dari tabel non gaji ledger
9. Deemed = 100
10. Tarif = pph di Sheet Non Gaji Ledger
11. Jenis Dok = Other
12. Nomor Referensi Dok = {input saat upload excel}
13. Tanggal Dok Referensi = {input saat upload excel} format = DD-MM-YYYY
14. ID TKU Pemotong = "0000032284044000000000"
15. Tanggal Pemotongan = Tanggal Dok Referensi

### Struktur Sheet Non Gaji Ledger

1. NIP = Dari Excel
2. NIP = Vlookup Ref Pegawai
3. Nama = Dari Excel
4. Status = Vlookup Ref Pegawai
5. PTKP = Vlookup Ref Pegawai
6. Golongan = Vlookup Ref Pegawai
7. Kotor = dari excel
8. potongan = dari excel
9. bersih = dari excel
10. PPH = dari excel
11. Keterangan = {input user saat upload excel}
12. SPM = {input user saat upload excel}

### Struktur Copy BPMP

1. Masa Pajak = Periode Bulan dalam number (contoh 2)
2. Tahun Pajak = Periode Tahun dalam number (contoh 2026)
3. Status Pegawai = "Resident"
4. NPWP = NIK (referensi dari Ref Pegawai)
5. Nomor Passport = Kosong
6. Status = Status PTKP (lihat di Pajak)
7. Posisi = Status ASN (PNS / PPPK lihat di Ref Pegawai)
8. Sertifikasi = N/A
9. Kode Objek Pajak = 21-100-01
10. Penghasilan Kotor = Sheet Pajak Kolom Total Penghasilan
11. Tarif = Ter
12. ID TKU = "0000032284044000000000"
13. Tgl Pemotongan = Tanggal 1 di masa pajak dan tahun pajak

### Struktur Perhitungan Pajak

1. NIP = ambil list dari summary di Rekap Gaji
2. NIK, Nama, Status, PTKP = VLOOKUP dari tabel Ref Pegawai
3. Status
4. Penyesuaian = kosongkan
5. Total Penghasilan = sum dari penghasilan pribadi yang ada di Rekap Gaji
6. Total PPH Tercatat = sum dari pajak pribadi yang ada di Rekap Gaji
7. Ter = diambil dari tabel ter
8. PPH kena pajak = penghasilan \* ter
9. Tarif penyesuaian = total pph tercatat / total penghasilan

### Struktur Sheet Gaji Ledger

#### GAJI

1. Nominal = penjumlahan antara kolom gjpokok = tjberas
2. PPH = tjpph
3. Tunjangan PPH = tjpph
4. potpfk10 = potpfk10
5. Keterangan = {input user saat upload excel}
6. SPM = {input user saat upload excel}

#### Tunjangan

1. Nominal = bersih
2. PPH = pajak
3. Tunjangan PPH = kalau PNS maka ambil pajak, kalau PPPK 0 (PNS / PPPK bisa dilihat di Sheet Ref Pegawai)
4. potpfk10 = 0
5. Keterangan = {input user saat upload excel}
6. SPM = {input user saat upload excel}
