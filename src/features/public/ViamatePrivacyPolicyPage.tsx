import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import "./viamatePrivacyPolicy.css";

type Language = "tr" | "en";
type Section = { title: string; paragraphs?: string[]; bullets?: string[] };

const content: Record<Language, { title: string; updated: string; description: string; sections: Section[] }> = {
  tr: {
    title: "VIAMATE Gizlilik Politikası",
    updated: "Son güncelleme: 22 Ağustos 2026",
    description: "VIAMATE mobil uygulamasının kullanıcı ve cihaz verilerini nasıl işlediğini açıklayan gizlilik politikası.",
    sections: [
      { title: "1. Hakkımızda", paragraphs: ["VIAMATE, VIAFA tarafından sunulan, saha çalışmalarında firma, kişi, görüşme, belge, fotoğraf, ses kaydı ve harcama bilgilerinin toplanmasını, düzenlenmesini ve dışa aktarılmasını sağlayan bir mobil uygulamadır.", "Bu Gizlilik Politikası, VIAMATE'in kullanıcı ve cihaz verilerine nasıl eriştiğini, bunları nasıl işlediğini ve belirli isteğe bağlı işlevlerde cihaz dışına nasıl aktardığını açıklar."] },
      { title: "2. Temel çalışma ve cihazda saklanan veriler", paragraphs: ["VIAMATE offline-first çalışacak şekilde tasarlanmıştır. Uygulamanın temel işlevleri için internet bağlantısı gerekmez.", "Kullanıcının oluşturduğu veya uygulamaya eklediği firma ve kişi bilgileri, iletişim bilgileri, görüşme kayıtları ve notları, çalışma bilgileri, fotoğraflar, belgeler, kartvizitler, QR/barkod verileri, ses kayıtları, harcama ve makbuz bilgileri temel olarak kullanıcının cihazında işlenir ve saklanır.", "Bu veriler, aşağıda açıklanan isteğe bağlı çevrimiçi özellik kullanılmadığı sürece VIAMATE tarafından geliştirici sunucularına otomatik olarak gönderilmez."] },
      { title: "3. Kamera ve görseller", paragraphs: ["VIAMATE; kartvizit tarama, QR/barkod okuma, makbuz tarama, fotoğraf çekme ve ilgili saha kayıtlarını oluşturmak amacıyla kamera erişimi isteyebilir.", "Kartvizit ve makbuz OCR işlemleri ile QR/barkod tanıma temel olarak cihaz üzerinde gerçekleştirilir.", "Kamera erişimi yalnız ilgili kullanıcı işlevleri için kullanılır."] },
      { title: "4. Mikrofon ve ses kayıtları", paragraphs: ["VIAMATE; sesli not ve görüşme kaydı gibi kullanıcı tarafından başlatılan özellikler için mikrofon erişimi isteyebilir.", "Ses kayıtları varsayılan olarak cihazda saklanır.", "Bir ses kaydının oluşturulması, kaydın otomatik olarak çevrimiçi bir hizmete gönderilmesine neden olmaz."] },
      { title: "5. İsteğe bağlı sesten yazıya çeviri", paragraphs: ["Sesten yazıya çeviri çevrimiçi çalışan ve kullanıcının ayrıca başlattığı isteğe bağlı bir özelliktir.", "Kullanıcı bu özelliği ilk kez kullanmadan önce, ses kaydının yazıya dönüştürülmek üzere bir bulut hizmetine gönderileceği uygulama içinde açıklanır ve kullanıcının devam etmeyi açıkça seçmesi gerekir.", "Kullanıcı devam ederse ilgili ses kaydı şifreli HTTPS bağlantısı üzerinden VIAFA'nın Cloudflare altyapısındaki sunucu bileşenine, oradan da transkripsiyonun gerçekleştirilmesi amacıyla OpenAI'nin ses transkripsiyon hizmetine iletilir.", "Kullanıcı bu işlemi başlatmazsa ses kaydı transkripsiyon amacıyla gönderilmez. İptal edilen veya başarısız olan transkripsiyon işlemleri cihazdaki orijinal ses kaydını silmez."] },
      { title: "6. Fairy", paragraphs: ["VIAMATE V1'de Fairy, görüşme notlarını veya görüşme içeriğini yapay zekâ analizi amacıyla otomatik olarak bir sunucuya göndermez.", "Fairy ile ilgili gelecekte yeni çevrimiçi veri işleme özellikleri kullanıma sunulursa gerekli gizlilik açıklamaları ve kullanıcı kontrolleri ilgili özellik kullanıma alınmadan önce güncellenecektir."] },
      { title: "7. Kişiler", paragraphs: ["VIAMATE, kullanıcının açıkça kullandığı kişi aktarma ve mevcut kişi kontrolü gibi işlevler için Android kişi izinlerini isteyebilir.", "Kişi bilgilerine erişim bu işlevleri gerçekleştirmek amacıyla kullanılır. VIAMATE'in temel kişi/firma çalışma verileri bu nedenle otomatik olarak VIAFA sunucularına yüklenmez."] },
      { title: "8. OCR, QR/barkod ve Google ML Kit", paragraphs: ["VIAMATE, kartvizit ve makbuz metinlerini tanımak ve QR/barkodları okumak için Google ML Kit teknolojilerini kullanabilir.", "İçerik tanıma işlemleri cihaz üzerinde gerçekleştirilir. Kullanılan Google/Android bileşenleri kendi çalışma, güvenlik veya teşhis mekanizmaları kapsamında sınırlı teknik veya kullanım verilerini işleyebilir."] },
      { title: "9. Dışa aktarma ve kullanıcı tarafından oluşturulan kopyalar", paragraphs: ["VIAMATE, kullanıcıların çalışmalarını Excel, ZIP, dosya, fotoğraf veya diğer desteklenen biçimlerde dışa aktarmasına ve paylaşmasına olanak tanır.", "Downloads/VIAMATE, Gallery, kullanıcı tarafından seçilen başka bir konum veya üçüncü taraf uygulamalara oluşturulan/aktarılan kopyalar kullanıcının kontrolündedir.", "VIAMATE içerisindeki bir çalışma veya kayıt daha sonra silinse bile, kullanıcının daha önce dışa aktardığı veya başka bir uygulamayla paylaştığı kopyalar otomatik olarak silinmeyebilir."] },
      { title: "10. Veri saklama ve silme", paragraphs: ["VIAMATE'in uygulamaya özel çalışma verileri kullanıcı tarafından yönetilir.", "Bir çalışmanın tamamlanması veya yeniden açılması verileri otomatik olarak silmez. Kullanıcının kalıcı silme işlemini seçmesi halinde ilgili çalışmaya ait VIAMATE tarafından yönetilen özel kayıtlar ve çalışma dosyaları silinir.", "Kullanıcının daha önce Downloads, Gallery, başka bir klasör veya başka bir uygulamaya aktardığı kopyalar bu işlemin dışında kalabilir ve gerektiğinde kullanıcı tarafından ayrıca silinmelidir.", "Uygulamanın kaldırılması Android tarafından yönetilen uygulamaya özel verileri kaldırabilir; uygulama dışında oluşturulmuş kullanıcı kontrollü kopyalar cihazda kalabilir."] },
      { title: "11. Güvenlik", paragraphs: ["Cihaz dışına gönderilen VIAMATE verileri modern şifreli bağlantılar, örneğin HTTPS/TLS, kullanılarak aktarılır.", "VIAMATE'in mobil uygulamasında OpenAI API anahtarı veya sunucuya ait ayrıcalıklı gizli kimlik bilgileri saklanmaz. Çevrimiçi servis sağlayıcı kimlik bilgileri sunucu tarafında tutulur."] },
      { title: "12. Reklam, takip ve hesaplar", paragraphs: ["VIAMATE V1:"], bullets: ["üçüncü taraf reklam göstermez;", "reklam profili oluşturmaz;", "genel amaçlı kullanıcı davranışı analitiği veya reklam takibi kullanmaz;", "VIAMATE hesabı oluşturmayı zorunlu tutmaz."] },
      { title: "13. Çocuklar", paragraphs: ["VIAMATE profesyonel saha çalışmaları ve iş kullanımı için tasarlanmıştır ve çocuklara yönelik bir ürün değildir."] },
      { title: "14. Üçüncü taraf hizmet sağlayıcılar", paragraphs: ["VIAMATE'in belirli özelliklerinde aşağıdaki teknoloji veya hizmet sağlayıcıları kullanılabilir:", "Cloudflare — VIAMATE'in çevrimiçi transkripsiyon isteğinin güvenli sunucu katmanının işletilmesi.", "OpenAI — kullanıcı tarafından açıkça başlatılan sesten yazıya çeviri işleminin gerçekleştirilmesi.", "Google ML Kit / Android hizmetleri — cihaz üzerinde OCR, QR/barkod tanıma ve ilgili Android işlevlerinin sağlanması.", "Bu hizmetler yalnız VIAMATE'in ilgili işlevlerini sağlamak amacıyla kullanılır."] },
      { title: "15. Gizlilik Politikasındaki değişiklikler", paragraphs: ["VIAMATE'in veri işleme uygulamaları veya çevrimiçi özellikleri değişirse bu Gizlilik Politikası güncellenebilir.", "Güncel sürüm bu sayfada yayımlanır ve son güncelleme tarihi belirtilir."] },
      { title: "16. İletişim", paragraphs: ["VIAFA", "E-posta: viamate@expoviafair.com", "Web: expoviafair.com"] },
    ],
  },
  en: {
    title: "VIAMATE Privacy Policy",
    updated: "Last updated: 22 August 2026",
    description: "Privacy Policy explaining how the VIAMATE mobile application processes user and device data.",
    sections: [
      { title: "1. About VIAMATE", paragraphs: ["VIAMATE is a mobile application provided by VIAFA for capturing, organizing, and exporting company, contact, meeting, document, photo, audio, and expense information during field work.", "This Privacy Policy explains how VIAMATE accesses and processes user and device data and when information may leave the device through specific optional features."] },
      { title: "2. Core operation and data stored on your device", paragraphs: ["VIAMATE is designed as an offline-first application. An internet connection is not required for its core capture, organization, and export workflows.", "Company and contact information, contact details, meeting records and notes, workspace information, photos, documents, business cards, QR/barcode data, audio recordings, expenses, and receipt information created or added by the user are primarily processed and stored on the user's device.", "VIAMATE does not automatically upload this information to VIAFA servers unless an optional online feature described below is explicitly used."] },
      { title: "3. Camera and images", paragraphs: ["VIAMATE may request camera access for features such as business-card scanning, QR/barcode scanning, receipt capture, photography, and creating related field records.", "Business-card and receipt OCR and QR/barcode recognition are primarily performed on the device.", "Camera access is used only to provide the relevant user-requested features."] },
      { title: "4. Microphone and audio recordings", paragraphs: ["VIAMATE may request microphone access for user-initiated features such as voice notes and meeting recordings.", "Audio recordings are stored locally by default.", "Creating a recording does not automatically send that recording to an online service."] },
      { title: "5. Optional voice transcription", paragraphs: ["Voice transcription is an optional online feature that must be separately initiated by the user.", "Before the first cloud transcription, VIAMATE explains in the app that the audio recording will be sent to a cloud service for transcription and requires the user to explicitly choose to continue.", "When the user continues, the selected audio recording is transmitted over an encrypted HTTPS connection to VIAFA's server component hosted on Cloudflare and then to OpenAI's audio transcription service for the purpose of generating the transcription.", "If the user does not initiate transcription, the audio recording is not sent for this purpose. Cancelling a transcription or a failed transcription does not delete the original local recording."] },
      { title: "6. Fairy", paragraphs: ["In VIAMATE V1, Fairy does not automatically send meeting notes or meeting content to a server for AI analysis.", "If future Fairy features introduce additional online data processing, appropriate privacy disclosures and user controls will be updated before those features are made available."] },
      { title: "7. Contacts", paragraphs: ["VIAMATE may request Android contacts permissions for user-initiated functions such as exporting a contact to the device address book and checking for an existing contact.", "Access to contacts is used to provide those functions. VIAMATE does not automatically upload the user's core company or contact workspace data to VIAFA servers as a result of this access."] },
      { title: "8. OCR, QR/barcodes, and Google ML Kit", paragraphs: ["VIAMATE may use Google ML Kit technologies to recognize text from business cards and receipts and to read QR codes and barcodes.", "Content recognition is performed on the device. Google or Android components used by the application may process limited technical, diagnostic, or usage information as part of their own operation, security, or diagnostics."] },
      { title: "9. Exports and user-created copies", paragraphs: ["VIAMATE allows users to export or share their work through Excel files, ZIP archives, files, photos, and other supported formats.", "Copies created in Downloads/VIAMATE, the device Gallery, another user-selected destination, or a third-party application are under the user's control.", "Deleting a workspace or record inside VIAMATE may not automatically delete copies that the user previously exported or shared with another application."] },
      { title: "10. Data retention and deletion", paragraphs: ["VIAMATE's app-managed workspace data is controlled by the user.", "Completing or reopening a workspace does not automatically delete its data. When the user chooses permanent deletion, VIAMATE deletes the private records and workspace files it manages for that workspace.", "Copies previously exported to Downloads, the Gallery, another folder, or another application may remain outside this deletion process and may need to be deleted separately by the user.", "Uninstalling the application may remove app-private data managed by Android. User-controlled copies created outside the app's private storage may remain on the device."] },
      { title: "11. Security", paragraphs: ["VIAMATE uses modern encrypted connections, including HTTPS/TLS, when data must be transmitted outside the device.", "The VIAMATE mobile application does not contain OpenAI API credentials or privileged server credentials. Credentials required by online service providers are maintained on the server side."] },
      { title: "12. Advertising, tracking, and accounts", paragraphs: ["VIAMATE V1:"], bullets: ["does not display third-party advertising;", "does not build advertising profiles;", "does not use general-purpose behavioral analytics or advertising tracking;", "does not require users to create a VIAMATE account."] },
      { title: "13. Children", paragraphs: ["VIAMATE is designed for professional field work and business use. It is not directed to children."] },
      { title: "14. Third-party service providers", paragraphs: ["Certain VIAMATE features may use the following technology or service providers:", "Cloudflare — hosting the secure server layer used for VIAMATE's online transcription requests.", "OpenAI — providing audio transcription when the user explicitly requests voice-to-text transcription.", "Google ML Kit / Android services — providing on-device OCR, QR/barcode recognition, and related Android functionality.", "These services are used only as necessary to provide the relevant VIAMATE functions."] },
      { title: "15. Changes to this Privacy Policy", paragraphs: ["This Privacy Policy may be updated if VIAMATE's data-processing practices or online features change.", "The current version will be published on this page together with its last-updated date."] },
      { title: "16. Contact", paragraphs: ["VIAFA", "Email: viamate@expoviafair.com", "Web: expoviafair.com"] },
    ],
  },
};

export function ViamatePrivacyPolicyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("lang") === "en" ? "en" : "tr";
  const [language, setLanguage] = useState<Language>(initial);
  const policy = useMemo(() => content[language], [language]);

  useEffect(() => {
    document.body.classList.add("privacy-public-body");
    document.documentElement.lang = language;
    document.title = `${policy.title} | VIAFA`;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content = policy.description;
    return () => document.body.classList.remove("privacy-public-body");
  }, [language, policy]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    setSearchParams(next === "en" ? { lang: "en" } : {}, { replace: true });
  }

  return (
    <div className="privacy-page">
      <header className="privacy-header">
        <Link className="privacy-brand" to="/">VIAFA</Link>
        <nav className="privacy-language" aria-label={language === "tr" ? "Dil seçimi" : "Language selection"}>
          <button className={language === "tr" ? "active" : ""} onClick={() => changeLanguage("tr")} type="button">TR</button>
          <button className={language === "en" ? "active" : ""} onClick={() => changeLanguage("en")} type="button">EN</button>
        </nav>
      </header>
      <main className="privacy-main">
        <article className="privacy-document">
          <p className="privacy-eyebrow">VIAMATE</p>
          <h1>{policy.title}</h1>
          <p className="privacy-updated">{policy.updated}</p>
          {policy.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            </section>
          ))}
        </article>
      </main>
      <footer className="privacy-footer">
        <span>© 2026 VIAFA</span>
        <a href="mailto:viamate@expoviafair.com">viamate@expoviafair.com</a>
      </footer>
    </div>
  );
}
