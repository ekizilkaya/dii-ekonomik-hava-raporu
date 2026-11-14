# DII Ekonomik Hava Tahmin Raporu

Türkiye'de ekonomik kamu algısını Google Trends aramaları ve TEFAS fon akımlarıyla her gün ölçen panel. Sayfa ayrıca
resmi göstergeleri yayımlanmadan önce tahmin eder ve tahminlerin isabetini kamuya açık bir karneyle raporlar.

Bu depo yalnızca yayımlanan sayfayı içerir ve otomatik olarak güncellenir. Elle değişiklik yapılmaz; her güncelleme
bir commit olarak kalır. Böylece hangi gün hangi tahminin yayımlandığı geriye dönük izlenebilir.

- `index.html`, `assets/`: bağımlılıksız statik sayfa
- `data/`: sayfanın okuduğu türetilmiş göstergeler (latest.json, signal.csv, clusters_weekly.csv, terms.csv, tefas.csv,
  nowcast_history.csv)

Yöntem özeti ve sınırlamalar sayfanın "Yöntem ve sınırlamalar" bölümündedir.

Veri kaynakları: Google Trends (Google LLC); TCMB EVDS; TÜİK; TEFAS (Takasbank). Göstergeler bu verilerden
türetilmiştir; kaynak kurumlar sonuçlardan sorumlu değildir.

**Yatırım tavsiyesi değildir.** Bu sayfadaki bilgiler SPK mevzuatı kapsamında yatırım danışmanlığı niteliği taşımaz.
