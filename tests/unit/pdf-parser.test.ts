import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/main/pdf/pdf-text-extractor', () => ({
  extractPdfText: vi.fn()
}));

import { extractPdfText } from '../../src/main/pdf/pdf-text-extractor';
import { parseUangMakanPdfRaw, parseHonorariumPdfRaw } from '../../src/main/pdf/pdf-parser';

const mockExtract = extractPdfText as unknown as ReturnType<typeof vi.fn>;

// Synthetic text shaped exactly like the real "Daftar Perhitungan Uang Makan"
// PDF after Y-axis clustering (see pdf-text-extractor.ts) — fictional names,
// same column layout as the real SAKTI export.
const UANG_MAKAN_TEXT = `Daftar Perhitungan Uang Makan
Satuan Kerja : BALAI KONSERVASI AIR TANAH
Anak Satker : PPPK KANTOR BKAT
Periode : Agustus 2026
Halaman 1
Kehadiran Tarif Jumlah Jumlah Tanda Tangan
No Nama Gol PPh Bersih No Rekening
Hari Kerja Uang Makan Kotor
1 2 3 4 5 6 7 8 9
1. Budi Santoso IX 13 37.000 481.000 24.050 456.950 1. ...............
199406112023212035 1200015362085
2. Siti Aminah IX 14 37.000 518.000 25.900 492.100 2. ...............
198906022025211064 1200015362101
Halaman 1 98 0 999.000 49.950 949.050
Total 999.000 49.950 949.050`;

// Synthetic text shaped like the real "Daftar Pembayaran Honorarium"
// PDF — fictional names, same jabatan/pangkat/perhitungan column layout.
const HONORARIUM_TEXT = `DAFTAR PEMBAYARAN
Honorarium Pengangkatan Pejabat Kuasa Pengguna Anggaran/Kuasa Pengguna Barang di Lingkungan Badan Geologi
Berdasarkan SK Kuasa Pengguna Anggaran Balai Konservasi Air Tanah
Kode : WA.1928.EBA.994.002.E.521115
Nomor : 49.K/KP.05/MEM.S/2026
Tanggal : 29 Januari 2026
Mei - Agustus
Jumlah Bruto Jumlah
No. N A M A JABATAN Pangkat Perhitungan PPh.(Rp.) TANDA TANGAN
(Rp) Diterima (Rp)
1 Agus Setiawan KPA IV 4 X Rp. 1.800.000 7.200.000 1.080.000 6.120.000 1 ……………………
JUMLAH 7.200.000 1.080.000 6.120.000
Setuju Dibayar : Jakarta, September 2026
Pejabat Pembuat Komitmen
Bendahara Pengeluaran
Fulan, S.T. Fulanah, S.Kom
NIP 198806152014021001 NIP 199507082022021001
DAFTAR PEMBAYARAN
Honorarium Pengangkatan Pejabat/Pegawai Pengelola Anggaran Pendapatan dan Belanja Negara pada Satuan Kerja Balai Konservasi Air Tanah, Badan Geologi, Kementerian Energi dan Sumber Daya Mineral
Berdasarkan SK Kuasa Pengguna Anggaran Balai Konservasi Air Tanah
Kode : WA.1928.EBA.994.002.E.521115
Nomor : 3.K/KU.02/BGE.KA/2026
Tanggal : 12 Februari 2026
Mei - Agustus
Jumlah Bruto Jumlah
No. N A M A JABATAN Pangkat Perhitungan PPh.(Rp.) TANDA TANGAN
(Rp) Diterima (Rp)
1 Dr. Joko Prasetyo PPSPM IV 4 X Rp. 750.000 3.000.000 450.000 2.550.000 1 ……………………
2 Dewi Lestari Bendahara Pengeluaran III 4 X Rp. 660.000 2.640.000 132.000 2.508.000 2 ……………………
JUMLAH 5.640.000 582.000 5.058.000
Setuju Dibayar : Jakarta, September 2026
Pejabat Pembuat Komitmen
Bendahara Pengeluaran
Fulan, S.T. Fulanah, S.Kom
NIP 198806152014021001 NIP 199507082022021001`;

describe('parseUangMakanPdfRaw', () => {
  it('parses rows with correct field mapping (kotor/potongan/bersih/nip)', async () => {
    mockExtract.mockResolvedValue(UANG_MAKAN_TEXT);
    const rows = await parseUangMakanPdfRaw(Buffer.from(''));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      nama: 'Budi Santoso',
      kotor: 481_000,
      potongan: 24_050,
      bersih: 456_950,
      pph: 5, // 24050 / 481000 * 100 = 5%
      nip: '199406112023212035'
    });
    expect(rows[1]).toEqual({
      nama: 'Siti Aminah',
      kotor: 518_000,
      potongan: 25_900,
      bersih: 492_100,
      pph: 5,
      nip: '198906022025211064'
    });
  });
});

describe('parseHonorariumPdfRaw', () => {
  it('parses rows across multiple DAFTAR PEMBAYARAN blocks with correct field mapping', async () => {
    mockExtract.mockResolvedValue(HONORARIUM_TEXT);
    const rows = await parseHonorariumPdfRaw(Buffer.from(''));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      nama: 'Agus Setiawan',
      kotor: 7_200_000,
      potongan: 1_080_000,
      bersih: 6_120_000,
      pph: 15 // KPA rate
    });
    expect(rows[1]).toEqual({
      nama: 'Dr. Joko Prasetyo',
      kotor: 3_000_000,
      potongan: 450_000,
      bersih: 2_550_000,
      pph: 15 // PPSPM rate
    });
    expect(rows[2]).toEqual({
      nama: 'Dewi Lestari',
      kotor: 2_640_000,
      potongan: 132_000,
      bersih: 2_508_000,
      pph: 5 // Bendahara Pengeluaran rate
    });
  });

  it('returns empty array when no rows match known jabatan list', async () => {
    mockExtract.mockResolvedValue('DAFTAR PEMBAYARAN\nnothing matches here\n');
    const rows = await parseHonorariumPdfRaw(Buffer.from(''));
    expect(rows).toHaveLength(0);
  });
});
