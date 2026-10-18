# SPECTRA — Vercel Static Private Beta Preview

Bu klasör **yalnızca tanıtım sayfalarını** içerir. API, Maigret, veritabanı ve çalışan kullanıcı kaydı kesinlikle dağıtılmaz.

## Vercel adımları
1. Bu paketteki `vercel-site` klasörünü ayrı bir Git deposu olarak GitHub’a gönderin. **`spectra-backend` klasörünü bu depoya koymayın.**
2. Vercel > Add New > Project > depoyu seçin. Framework Preset: `Other`. Build Command: boş. Output Directory: `.`.
3. Git deposunun kökünde `vercel.json`, `index.html`, `assets/` olduğundan emin olun.
4. Önce `*.vercel.app` önizlemesini test edin. Alan adı satın alınır ve DNS doğrulanırsa Project > Settings > Domains bölümünden `spectra.tools` ekleyin.
5. Bu sürüm noindex/robots disallow kullanır. Beta sayfası yayına hazır olduğunda SEO davranışı ayrıca kararlaştırılmalıdır.

`/giris` gerçek oturum açma değildir; `/beta` şu anda başvuru bilgisi toplamaz. API yoktur. Ödeme yoktur.

**GÜVENLİK:** Public sunucu için mevcut FastAPI projesini doğrudan Vercel’e yüklemeyin. Araştırma API’si kullanıcı kimlik doğrulaması ve veriye özel izin kontrolleri tamamlanana kadar kapalı kalmalıdır.
