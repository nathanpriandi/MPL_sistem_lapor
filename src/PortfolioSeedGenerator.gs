/**
 * PortfolioSeedGenerator.gs — Rich Multi-Month Portfolio Synthetic Dataset Generator
 * Digital Reporting System for Integrated Agriculture Company (Agri-Digital Showcase)
 * 
 * Clean Architecture Layer: UTILITIES / PORTFOLIO SEEDER
 * Purpose: FOR PORTFOLIO DEMO DEPLOYMENT ONLY.
 * Generates 90+ realistic agricultural, livestock, fishery, and field operations records
 * covering multi-month date distributions, diverse commodities, varied harvest schedules,
 * incident triage entries, and transaction records so that all charts, trend curves,
 * leaderboards, and decision matrices render with rich, professional demonstration data.
 * 
 * NOTE: Uses 100% fictional personnel and entities.
 */

/**
 * Generates comprehensive multi-month portfolio seed data into Master_Laporan and current daily sheet.
 * @param {Object} [options] - { clearExisting: boolean, recordCount: number }
 * @returns {{ success: boolean, count: number, message: string }}
 */
function generatePortfolioSeedData(options) {
  options = options || {};
  Logger.log('Starting generation of rich portfolio demonstration dataset...');

  const ss = SpreadsheetRepository.getSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet database belum dikonfigurasi atau tidak dapat diakses.');
  }

  const effectiveHeaders = OPERATIONAL_REPORT_FIELDS.map(f => f.header);

  // 1. Prepare Master_Laporan sheet
  let masterSheet = ss.getSheetByName('Master_Laporan');
  if (!masterSheet) {
    masterSheet = ss.insertSheet('Master_Laporan', 0);
  }
  SpreadsheetRepository.ensureHeaderRow_(masterSheet, effectiveHeaders);

  if (options.clearExisting !== false && masterSheet.getLastRow() > 1) {
    masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, masterSheet.getLastColumn()).clearContent();
    Logger.log('Cleared existing records in Master_Laporan for clean portfolio seed.');
  }

  // 2. Prepare today's daily sheet
  const now = new Date();
  const todayStr = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd');
  const dailyTabName = `Laporan_${todayStr}`;
  let dailySheet = ss.getSheetByName(dailyTabName);
  if (!dailySheet) {
    dailySheet = ss.insertSheet(dailyTabName);
  }
  SpreadsheetRepository.ensureHeaderRow_(dailySheet, effectiveHeaders);

  if (options.clearExisting !== false && dailySheet.getLastRow() > 1) {
    dailySheet.getRange(2, 1, dailySheet.getLastRow() - 1, dailySheet.getLastColumn()).clearContent();
  }

  // Demonstration documentation photos (Unsplash high-res agricultural assets)
  const DEMO_PHOTOS = [
    'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=800&auto=format&fit=crop', // farm inspection
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop', // crops & greenery
    'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=800&auto=format&fit=crop', // tractor & soil
    'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=800&auto=format&fit=crop', // corn field
    'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800&auto=format&fit=crop', // harvest produce
    'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=800&auto=format&fit=crop'  // livestock cattle
  ];

  // Helper date formatter: creates timestamp N days before now
  function getDateAgo(daysAgo, hour, minute) {
    const d = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    d.setHours(hour || 8, minute || 30, 0, 0);
    return Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  }

  function getDateOnlyAgo(daysAgo) {
    const d = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    return Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd');
  }

  // Fictional Personnel Roster
  const PICS = {
    FAJAR: { id: 'ALP-01', name: 'Fajar Nugraha', div: 'Alprof', telp: '081211223344' },
    DIAN: { id: 'ALP-02', name: 'Dian Permana', div: 'Alprof', telp: '081255667788' },
    TRI: { id: 'ALP-03', name: 'Tri Cahyono', div: 'Alprof', telp: '081299887766' },
    BAYU: { id: 'ALP-04', name: 'Bayu Firmansyah', div: 'Alprof', telp: '081322334455' },
    HENDRA: { id: 'MNJ-01', name: 'Hendra Gunawan', div: 'Manajemen', telp: '081344556677' },
    BUDI: { id: 'MNJ-02', name: 'Budi Pratama', div: 'Manajemen', telp: '081366778899' },
    AGUS: { id: 'MNJ-06', name: 'Agus Setiawan', div: 'Manajemen', telp: '081388990011' },
    WAYAN: { id: 'SGA-01', name: 'Wayan Darmawan', div: 'SGA', telp: '081298765432' },
    MADE: { id: 'SGA-02', name: 'Made Suardika', div: 'SGA', telp: '082468095731' }
  };

  const SITES = ['Jonggol', 'Cikalong', 'Sukabumi', 'Bogor'];

  // SGA Team attendance string generator
  function getSgaRosterAttendance(focusSite, isEmergency) {
    return [
      `Agung Wicaksono (SGA-03): [Hadir] ${focusSite} Pos Utama`,
      `Galih Pramono (SGA-04): [Hadir] ${focusSite} Patroli Blok Barat`,
      `Dimas Kurniawan (SGA-05): [Hadir] ${focusSite} Patroli Blok Timur`,
      `Bagus Pangestu (SGA-06): [Hadir] ${focusSite} Gerbang Masuk & Timbangan`,
      `Arif Budiman (SGA-07): [Hadir] ${focusSite} Pengawasan Gudang Logistik`,
      `Indra Lesmana (SGA-08): [Hadir] ${focusSite} Keliling Pagar Batas`,
      `Yoga Pratama (SGA-09): [Hadir] ${focusSite} Monitoring Ruang CCTV`,
      `Faisal Rahman (SGA-10): [${isEmergency ? 'Hadir' : 'Tidak Hadir'}] ${isEmergency ? 'Penanganan Lapangan' : 'Izin Sakit'}`,
      `Gilang Ramadhan (SGA-11): [Hadir] ${focusSite} Pengawalan Distribusi Panen`,
      `Doni Hendrawan (SGA-12): [Hadir] ${focusSite} Koordinasi Tenaga Harian`
    ].join('; ');
  }

  // ===========================================================================
  // DATASET COMPOSITION: 96 RICH DIVERSE OPERATIONAL RECORDS
  // ===========================================================================
  const seedRecords = [];
  let seq = 1;

  function padSeq(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // --- SECTOR 1: AGRO (PERTANIAN / PERKEBUNAN) — 46 RECORDS ---
  const AGRO_CROPS = [
    { crop: 'Alpukat Aligator', yieldMin: 1200, yieldMax: 4800, price: 32000, hst: 720, unit: 'Kg' },
    { crop: 'Jagung Manis', yieldMin: 2000, yieldMax: 6500, price: 6800, hst: 75, unit: 'Kg' },
    { crop: 'Pisang Cavendish', yieldMin: 1500, yieldMax: 5200, price: 11500, hst: 270, unit: 'Kg' },
    { crop: 'Cabai Rawit Merah', yieldMin: 400, yieldMax: 1800, price: 42000, hst: 90, unit: 'Kg' },
    { crop: 'Padi Organik', yieldMin: 3000, yieldMax: 8500, price: 9500, hst: 115, unit: 'Kg' }
  ];

  const BUYERS = [
    { name: 'Koperasi Tani Makmur Sejahtera', addr: 'Jl. Raya Jonggol No. 12', telp: '081288991122' },
    { name: 'Pasar Induk Kramat Jati (Kios Berkah 08)', addr: 'Pasar Induk Kramat Jati, Jakarta Timur', telp: '081399882233' },
    { name: 'PT Distribusi Pangan Nusantara', addr: 'Kawasan Industri Cibinong Blok C-4', telp: '082144556677' },
    { name: 'Supermarket Segar Alami', addr: 'Jl. Pajajaran No. 88, Bogor', telp: '081277665544' }
  ];

  // 46 Agro records spread over last 85 days
  for (let i = 0; i < 46; i++) {
    const daysAgo = Math.floor((i / 46) * 85);
    const cropObj = AGRO_CROPS[i % AGRO_CROPS.length];
    const site = SITES[i % SITES.length];
    const picKeys = ['FAJAR', 'DIAN', 'TRI', 'BAYU', 'HENDRA'];
    const pic = PICS[picKeys[i % picKeys.length]];
    const buyer = BUYERS[i % BUYERS.length];
    const isHarvest = (i % 3 === 0);
    const isPlanting = (i % 3 === 1);
    const hasObstacle = (i % 5 === 2);

    let activityType = 'Perawatan';
    let harvestQty = 0;
    let salesValue = 0;
    let unitPrice = 0;
    let plantingQty = 0;
    let landArea = 5000 + ((i * 1200) % 20000);
    let kendala = '';
    let upaya = '';
    let severity = 'normal';
    let reviewed = (daysAgo > 3 || i % 4 !== 0) ? 'Terverifikasi' : 'Belum Terverifikasi';

    if (isPlanting) {
      activityType = 'Tanam atau tebar';
      plantingQty = 250 + ((i * 150) % 1500);
    } else if (isHarvest) {
      activityType = 'Panen atau penjualan';
      harvestQty = cropObj.yieldMin + ((i * 350) % (cropObj.yieldMax - cropObj.yieldMin));
      unitPrice = cropObj.price;
      salesValue = harvestQty * unitPrice;
    }

    if (hasObstacle) {
      severity = (i % 2 === 0) ? 'urgent' : 'normal';
      const obstaclesList = [
        { k: 'Penyumbatan sedimen pada pipa irigasi tetes sektor barat akibat lumpur hujan', u: 'Pembersihan saringan filter dan pembilasan tekanan tinggi bersama 4 staf' },
        { k: 'Deteksi bercak daun cercospora pada barisan bibit tanaman muda', u: 'Aplikasi fungisida hayati trichoderma dan pemangkasan daun yang terinfeksi' },
        { k: 'Keterlambatan pasokan pupuk NPK dari distributor rekanan', u: 'Substitusi sementara dengan pupuk organik cair fermentasi mandiri' },
        { k: 'Serangan ulat grayak ringan pada tanaman jagung blok utara', u: 'Penyemprotan biopestisida daun mimba pada sore hari' },
        { k: 'Akses jalan lingkar kebun licin dan berlumpur pasca hujan deras', u: 'Penimbunan sirtu dan pengerasan manual oleh tim lapangan' }
      ];
      const obs = obstaclesList[i % obstaclesList.length];
      kendala = obs.k;
      upaya = (reviewed === 'Terverifikasi') ? obs.u : 'Menunggu koordinasi tim teknis';
    }

    const tglKegiatan = getDateOnlyAgo(daysAgo);
    const estPanen = getDateOnlyAgo(Math.max(0, daysAgo - cropObj.hst));

    seedRecords.push({
      reportId: `rep_seed_agr_${padSeq(seq)}`,
      idKaryawan: pic.id,
      kodeKegiatan: `AGR-${site.toUpperCase().substring(0, 6)}-${tglKegiatan.replace(/-/g, '')}-${padSeq(seq)}`,
      timestamp: getDateAgo(daysAgo, 9 + (i % 6), 15),
      namaPic: pic.name,
      bidangDivisi: 'Agro (Pertanian/Perkebunan)',
      nomorTelepon: pic.telp,
      lokasiKegiatan: site,
      jenisKegiatan: activityType,
      statusPengelolaan: 'Swakelola',
      statusPengelolaanPanen: isHarvest ? 'Swakelola' : '',
      komoditas: cropObj.crop,
      komoditasPanen: isHarvest ? cropObj.crop : '',
      lokasiBlok: `Blok ${String.fromCharCode(65 + (i % 6))}-${(i % 4) + 1}`,
      lokasiBlokTanam: isPlanting ? `Blok ${String.fromCharCode(65 + (i % 6))}-${(i % 4) + 1}` : '',
      lokasiBlokPanen: isHarvest ? `Blok ${String.fromCharCode(65 + (i % 6))}-${(i % 4) + 1}` : '',
      luasLahanM2: landArea,
      luasLahanPanenM2: isHarvest ? landArea : 0,
      jumlahBenih: plantingQty,
      populasiAgro: plantingQty || (harvestQty ? harvestQty / 2 : 1500),
      tglTanam: isPlanting ? tglKegiatan : getDateOnlyAgo(daysAgo + 60),
      estimasiPanenHst: cropObj.hst,
      tglPanen: isHarvest ? tglKegiatan : '',
      jumlahPanen: harvestQty,
      jumlahPanenKg: harvestQty,
      tglPenjualan: isHarvest ? tglKegiatan : '',
      tujuanDistribusi: isHarvest ? 'Penjualan' : '',
      jumlahPenjualanUnit: harvestQty,
      hargaSatuanRp: unitPrice,
      hargaJual: unitPrice,
      totalHargaRp: salesValue,
      nilaiPenjualanRp: salesValue,
      pembeliNama: isHarvest ? buyer.name : '',
      pembeliAlamat: isHarvest ? buyer.addr : '',
      pembeliTelp: isHarvest ? buyer.telp : '',
      pembeliNoTelp: isHarvest ? buyer.telp : '',
      capaianKegiatan: isHarvest
        ? `Panen raya ${cropObj.crop} sebanyak ${harvestQty} ${cropObj.unit}. Kualitas grade A, langsung ditimbang dan diserap oleh ${buyer.name}.`
        : isPlanting
          ? `Selesai penanaman ${plantingQty} bibit ${cropObj.crop} pada lahan seluas ${landArea} m2 dengan aplikasi pupuk dasar organik.`
          : `Perawatan intensif dan monitoring kelembaban tanah komoditas ${cropObj.crop} di ${site}. Kondisi vegetatif tumbuh optimal.`,
      kendala: kendala,
      upaya: upaya,
      severity: severity,
      reviewed: reviewed,
      fotoUrl: DEMO_PHOTOS[i % DEMO_PHOTOS.length],
      fotoUrl2: DEMO_PHOTOS[(i + 1) % DEMO_PHOTOS.length],
      fotoUrl3: DEMO_PHOTOS[(i + 2) % DEMO_PHOTOS.length],
      photos: [DEMO_PHOTOS[i % DEMO_PHOTOS.length], DEMO_PHOTOS[(i + 1) % DEMO_PHOTOS.length], DEMO_PHOTOS[(i + 2) % DEMO_PHOTOS.length]]
    });
    seq++;
  }

  // --- SECTOR 2: TERNAK (PETERNAKAN) — 26 RECORDS ---
  const LIVESTOCK_TYPES = [
    { type: 'Sapi Potong', popBase: 50, feedPerDay: 1200, prodName: 'Pupuk Kandang / Kohe', prodPrice: 25000, prodUnit: 120 },
    { type: 'Domba Garut', popBase: 120, feedPerDay: 450, prodName: 'Domba Hidup (Kurban / Bibit)', prodPrice: 2800000, prodUnit: 4 },
    { type: 'Ayam Petelur', popBase: 2500, feedPerDay: 280, prodName: 'Telur Ayam Segar', prodPrice: 26000, prodUnit: 180 }
  ];

  for (let j = 0; j < 26; j++) {
    const daysAgo = Math.floor((j / 26) * 85);
    const lObj = LIVESTOCK_TYPES[j % LIVESTOCK_TYPES.length];
    const site = (j % 2 === 0) ? 'Jonggol' : 'Cikalong';
    const pic = (j % 2 === 0) ? PICS.FAJAR : PICS.AGUS;
    const isSales = (j % 3 === 0);
    const hasMutation = (j % 2 === 1);
    const hasObstacle = (j % 6 === 3);

    let birth = 0, death = 0, buy = 0, sell = 0;
    let masukDesc = 'Tidak Ada', keluarDesc = 'Tidak Ada';
    let masukQty = 0, keluarQty = 0;

    if (hasMutation) {
      if (j % 4 === 1) {
        birth = (lObj.type === 'Sapi Potong') ? 2 : ((lObj.type === 'Domba Garut') ? 4 : 0);
        masukDesc = birth > 0 ? `Kelahiran (${birth} ekor)` : 'Tidak Ada';
        masukQty = birth;
      } else if (j % 4 === 3) {
        buy = 5;
        masukDesc = `Pembelian bibit (${buy} ekor)`;
        masukQty = buy;
      }
    }

    let salesVal = 0;
    let salesQty = 0;
    if (isSales) {
      salesQty = lObj.prodUnit;
      salesVal = salesQty * lObj.prodPrice;
      sell = (lObj.type === 'Domba Garut') ? salesQty : 0;
      if (sell > 0) {
        keluarDesc = `Penjualan (${sell} ekor)`;
        keluarQty = sell;
      }
    }

    let kendala = '', upaya = '', severity = 'normal';
    let reviewed = (daysAgo > 2) ? 'Terverifikasi' : 'Belum Terverifikasi';
    if (hasObstacle) {
      severity = 'urgent';
      kendala = 'Suhu kandang meningkat akibat ventilasi samping terhalang dedaunan lebat';
      upaya = 'Pembersihan kanopi vegetasi sekitar kandang dan penambahan kipas sirkulasi portable';
    }

    const tglKegiatan = getDateOnlyAgo(daysAgo);

    seedRecords.push({
      reportId: `rep_seed_trn_${padSeq(seq)}`,
      idKaryawan: pic.id,
      kodeKegiatan: `TRN-${site.toUpperCase().substring(0, 6)}-${tglKegiatan.replace(/-/g, '')}-${padSeq(seq)}`,
      timestamp: getDateAgo(daysAgo, 10 + (j % 4), 30),
      namaPic: pic.name,
      bidangDivisi: 'Ternak (Peternakan)',
      nomorTelepon: pic.telp,
      lokasiKegiatan: site,
      jenisKegiatan: isSales ? 'Panen atau penjualan' : 'Pengawasan',
      jenisTernak: lObj.type,
      populasiTernak: lObj.popBase + birth + buy - sell - death,
      ternakMasuk: masukDesc,
      ternakMasukJenis: birth > 0 ? 'Kelahiran' : (buy > 0 ? 'Pembelian' : 'Tidak Ada'),
      ternakMasukKelahiranQty: birth,
      ternakMasukPembelianQty: buy,
      ternakMasukQty: masukQty,
      ternakKeluar: keluarDesc,
      ternakKeluarJenis: sell > 0 ? 'Penjualan' : (death > 0 ? 'Kematian' : 'Tidak Ada'),
      ternakKeluarKematianQty: death,
      ternakKeluarPenjualanQty: sell,
      ternakKeluarQty: keluarQty,
      pakanMasukKg: lObj.feedPerDay + ((j * 40) % 200),
      pakanKeluarKg: lObj.feedPerDay - 20 + ((j * 30) % 150),
      jenisKomoditasTernak: isSales ? lObj.prodName : '',
      jumlahPenjualanTernak: salesQty,
      hargaSatuanTernakRp: isSales ? lObj.prodPrice : 0,
      totalHargaTernakRp: salesVal,
      pembeliTernakNama: isSales ? 'Koperasi Mitra Peternak Mandiri' : '',
      pembeliTernakAlamat: isSales ? 'Jl. Pahlawan Agraria No. 24, Bogor' : '',
      pembeliTernakTelp: isSales ? '081299001122' : '',
      pembeliTernakNoTelp: isSales ? '081299001122' : '',
      capaianKegiatan: isSales
        ? `Penjualan komoditas peternakan ${lObj.prodName} sebanyak ${salesQty} unit senilai Rp ${salesVal.toLocaleString('id-ID')}. Kondisi ternak sehat.`
        : `Monitoring kesehatan berkala, sanitasi kandang, dan distribusi pakan harian ternak ${lObj.type}. Populasi tercatat stabil.`,
      kendala: kendala,
      upaya: upaya,
      severity: severity,
      reviewed: reviewed,
      fotoUrl: DEMO_PHOTOS[(j + 2) % DEMO_PHOTOS.length],
      fotoUrl2: DEMO_PHOTOS[(j + 3) % DEMO_PHOTOS.length],
      fotoUrl3: DEMO_PHOTOS[(j + 4) % DEMO_PHOTOS.length],
      photos: [DEMO_PHOTOS[(j + 2) % DEMO_PHOTOS.length], DEMO_PHOTOS[(j + 3) % DEMO_PHOTOS.length], DEMO_PHOTOS[(j + 4) % DEMO_PHOTOS.length]]
    });
    seq++;
  }

  // --- SECTOR 3: IKAN (PERIKANAN) — 12 RECORDS ---
  const FISH_TYPES = [
    { type: 'Nila Merah', harvestKg: 850, price: 32000, feedKg: 400 },
    { type: 'Lele Sangkuriang', harvestKg: 1400, price: 23000, feedKg: 650 },
    { type: 'Gurame Soang', harvestKg: 550, price: 55000, feedKg: 320 }
  ];

  for (let k = 0; k < 12; k++) {
    const daysAgo = Math.floor((k / 12) * 80);
    const fObj = FISH_TYPES[k % FISH_TYPES.length];
    const site = (k % 2 === 0) ? 'Sukabumi' : 'Cikalong';
    const pic = PICS.DIAN;
    const isHarvest = (k % 2 === 1);
    const tglKegiatan = getDateOnlyAgo(daysAgo);
    const salesVal = isHarvest ? fObj.harvestKg * fObj.price : 0;

    seedRecords.push({
      reportId: `rep_seed_ikn_${padSeq(seq)}`,
      idKaryawan: pic.id,
      kodeKegiatan: `IKN-${site.toUpperCase().substring(0, 6)}-${tglKegiatan.replace(/-/g, '')}-${padSeq(seq)}`,
      timestamp: getDateAgo(daysAgo, 14, 20),
      namaPic: pic.name,
      bidangDivisi: 'Ikan (Perikanan)',
      nomorTelepon: pic.telp,
      lokasiKegiatan: site,
      jenisKegiatan: isHarvest ? 'Panen atau penjualan' : 'Perawatan',
      komoditas: fObj.type,
      komoditasPanen: isHarvest ? fObj.type : '',
      lokasiBlok: `Kolam Terpal ${k + 1}`,
      jumlahPanenKg: isHarvest ? fObj.harvestKg : 0,
      jumlahPanen: isHarvest ? fObj.harvestKg : 0,
      totalHargaRp: salesVal,
      nilaiPenjualanRp: salesVal,
      hargaSatuanRp: isHarvest ? fObj.price : 0,
      pembeliNama: isHarvest ? 'Restoran Kuring Nusantara' : '',
      pembeliAlamat: isHarvest ? 'Jl. Raya Tajur No. 50, Bogor' : '',
      pembeliTelp: isHarvest ? '081388112233' : '',
      capaianKegiatan: isHarvest
        ? `Panen ikan ${fObj.type} segar sebanyak ${fObj.harvestKg} Kg. Seluruh ikan hidup lolos sortir dan langsung diangkut bak aerasi pembeli.`
        : `Pemberian pakan pelet apung ${fObj.feedKg} Kg dan pengukuran kualitas air kolam (pH 7.2, DO 5.8 ppm, suhu 28°C normal).`,
      kendala: '',
      upaya: '',
      severity: 'normal',
      reviewed: 'Terverifikasi',
      fotoUrl: DEMO_PHOTOS[k % DEMO_PHOTOS.length],
      fotoUrl2: DEMO_PHOTOS[(k + 1) % DEMO_PHOTOS.length],
      fotoUrl3: DEMO_PHOTOS[(k + 2) % DEMO_PHOTOS.length],
      photos: [DEMO_PHOTOS[k % DEMO_PHOTOS.length], DEMO_PHOTOS[(k + 1) % DEMO_PHOTOS.length], DEMO_PHOTOS[(k + 2) % DEMO_PHOTOS.length]]
    });
    seq++;
  }

  // --- SECTOR 4: SGA (TIM BUDIDAYA & LAPANGAN) — 12 RECORDS ---
  for (let m = 0; m < 12; m++) {
    const daysAgo = Math.floor((m / 12) * 80);
    const site = SITES[m % SITES.length];
    const pic = (m % 2 === 0) ? PICS.WAYAN : PICS.MADE;
    const hasObstacle = (m % 3 === 1);
    const tglKegiatan = getDateOnlyAgo(daysAgo);

    let kendala = '', upaya = '', severity = 'normal';
    let reviewed = (daysAgo > 1) ? 'Terverifikasi' : 'Belum Terverifikasi';

    if (hasObstacle) {
      severity = 'urgent';
      kendala = 'Tembok drainase parit batas timur retak akibat limpasan air hujan intensitas tinggi';
      upaya = 'Pemasangan barikade karung pasir penahan dan plester semen cepat kering bersama 6 personel SGA';
    }

    seedRecords.push({
      reportId: `rep_seed_sga_${padSeq(seq)}`,
      idKaryawan: pic.id,
      kodeKegiatan: `SGA-${site.toUpperCase().substring(0, 6)}-${tglKegiatan.replace(/-/g, '')}-${padSeq(seq)}`,
      timestamp: getDateAgo(daysAgo, 7 + (m % 2), 45),
      namaPic: pic.name,
      bidangDivisi: 'SGA',
      nomorTelepon: pic.telp,
      lokasiKegiatan: site,
      jenisKegiatan: 'Pengawasan',
      pengawasan: 'Supervisi Operasional Lapangan & Pos Jaga',
      detailPengawasan: `Inspeksi keliling area budidaya ${site}, pengecekan pagar perimeter, dan apel kesiapan personel regu jaga.`,
      capaianKegiatan: `Patroli keamanan dan pendampingan tenaga kerja lapangan di ${site} terlaksana lengkap. Log inventaris pos tercatat tertib.`,
      anggotaTerlapor: getSgaRosterAttendance(site, hasObstacle),
      kendala: kendala,
      upaya: upaya,
      severity: severity,
      reviewed: reviewed,
      fotoUrl: DEMO_PHOTOS[(m + 1) % DEMO_PHOTOS.length],
      fotoUrl2: DEMO_PHOTOS[(m + 2) % DEMO_PHOTOS.length],
      fotoUrl3: DEMO_PHOTOS[(m + 3) % DEMO_PHOTOS.length],
      photos: [DEMO_PHOTOS[(m + 1) % DEMO_PHOTOS.length], DEMO_PHOTOS[(m + 2) % DEMO_PHOTOS.length], DEMO_PHOTOS[(m + 3) % DEMO_PHOTOS.length]]
    });
    seq++;
  }

  // Write all generated records in batch
  Logger.log(`Mapping and writing ${seedRecords.length} portfolio records to spreadsheet...`);
  const masterRows = [];
  const dailyRows = [];

  seedRecords.forEach(itemData => {
    const report = OperationalReport(itemData);
    const flag = {
      severity: itemData.severity || ReportSeverity.NORMAL,
      matchedKeywords: itemData.kendala ? itemData.kendala.split(' ').slice(0, 3).join(', ') : ''
    };

    const rowValues = OPERATIONAL_REPORT_FIELDS.map(fieldDef => {
      let val = fieldDef.getValue(report, flag);
      if (fieldDef.key === 'reviewed' && itemData.reviewed) val = itemData.reviewed;
      if (fieldDef.key === 'severity' && itemData.severity) val = itemData.severity;
      if (typeof SecurityService !== 'undefined' && SecurityService.InputSanitizer) {
        val = SecurityService.InputSanitizer.sanitizeForSpreadsheet(val);
      }
      return val;
    });

    masterRows.push({ values: rowValues, severity: flag.severity });

    // Include reports from the last 7 days into today's active daily sheet
    if (itemData.timestamp && itemData.timestamp.startsWith(todayStr)) {
      dailyRows.push({ values: rowValues, severity: flag.severity });
    }
  });

  // Batch append to Master_Laporan
  if (masterRows.length > 0) {
    const startRow = masterSheet.getLastRow() + 1;
    const numRows = masterRows.length;
    const numCols = effectiveHeaders.length;
    masterSheet.getRange(startRow, 1, numRows, numCols).setValues(masterRows.map(r => r.values));

    masterRows.forEach((r, idx) => {
      SpreadsheetRepository.applyRowHighlighting(masterSheet, startRow + idx, r.severity);
    });
  }

  // Batch append to Daily sheet (if any current-date records, or seed recent 5 rows)
  const recentRows = (dailyRows.length > 0) ? dailyRows : masterRows.slice(-5);
  if (recentRows.length > 0) {
    const startRow = dailySheet.getLastRow() + 1;
    dailySheet.getRange(startRow, 1, recentRows.length, effectiveHeaders.length).setValues(recentRows.map(r => r.values));
    recentRows.forEach((r, idx) => {
      SpreadsheetRepository.applyRowHighlighting(dailySheet, startRow + idx, r.severity);
    });
  }

  Logger.log(`Successfully seeded ${seedRecords.length} rich portfolio records!`);
  return {
    success: true,
    count: seedRecords.length,
    message: `Berhasil menambahkan ${seedRecords.length} data laporan operasional portofolio dengan sebaran waktu 90 hari, variasi komoditas lengkap, jadwal panen, dan status kendala terstandarisasi.`
  };
}

/**
 * Clean Architecture Namespace
 */
const PortfolioSeedGenerator = {
  generatePortfolioSeedData: generatePortfolioSeedData,
  seedPortfolioData: generatePortfolioSeedData
};

