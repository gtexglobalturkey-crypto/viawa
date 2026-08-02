// Extracted verbatim from the existing, previously-approved master
// template resources/templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx
// (word/document.xml) — the project's real legal text, not newly
// authored. No clause content here is invented; only whitespace/line
// breaks were normalized for HTML rendering.
export type ContractClause = {
  number: number;
  title: string;
  body: string[];
};

export const CONTRACT_CLAUSES: ContractClause[] =
  [
    {
      number: 1,
      title: "SÖZLEŞMENİN KAPSAMI",
      body: [
        "Bu sözleşme, ana organizatör tarafından düzenlenen katılım sözleşmesine ek olarak hazırlanmış olup, EXPOVIA Uluslararası Fuarcılık Teknoloji İç ve Dış Ticaret Ltd. Şti. ile katılımcı arasındaki karşılıklı hak ve yükümlülükleri düzenler. Fuarın organizasyonu, katılım şartları, teknik kurallar ve organizasyon sürecine ilişkin hususlarda ana organizatör sözleşmesi hükümleri uygulanır.",
        "EXPOVIA, fuarın organizatörü olmayıp yalnızca organizatörün yetkili temsilcisi ve katılım koordinasyon hizmeti sağlayıcısıdır. EXPOVIA, organizatörün karar, uygulama ve işlemlerinden doğrudan sorumlu değildir.",
      ],
    },
    {
      number: 2,
      title:
        "EXPOVIA'NIN HİZMET KAPSAMI VE YÜKÜMLÜLÜKLERİ",
      body: [
        "• Katılım sürecinin koordinasyonu",
        "• Organizatör ile iletişimin yürütülmesi",
        "• Katılım belgelerinin takibi",
        "• Stand ve fuar bilgilerinin katılımcıya iletilmesi",
        "• Gerekli operasyonel yönlendirmelerin yapılması",
        "• Sözleşmede belirtilen ilave hizmetlerin koordinasyonu",
        "EXPOVIA, yukarıdaki hizmetleri makul özen çerçevesinde yerine getirir. Organizatörün kararları, uygulamaları, gecikmeleri veya üçüncü kişilerin işlem ve faaliyetlerinden kaynaklanan sonuçlardan sorumlu tutulamaz.",
      ],
    },
    {
      number: 3,
      title:
        "KATILIMCI FİRMANIN YÜKÜMLÜLÜKLERİ",
      body: [
        "• Talep edilen firma ve imza bilgilerini zamanında iletmek",
        "• Organizatör ve EXPOVIA ödemelerini belirtilen vadelerde yapmak",
        "• Fuar kurallarına ve teknik şartlara uymak",
        "• Stand uygulamalarında organizatör onaylarını almak",
        "• Katılımcı, ürün ve personel bilgilerini zamanında bildirmek",
        "• Vize, seyahat, nakliye ve gümrük işlemlerini takip etmek",
      ],
    },
    {
      number: 4,
      title: "İPTAL VE DEĞİŞİKLİKLER",
      body: [
        "Katılımcının katılımını iptal etmesi halinde organizatörün iptal ve iade koşulları uygulanır. EXPOVIA, organizatör tarafından tahsil edilen veya organizatöre aktarılmış bedellerin iadesinden sorumlu değildir. EXPOVIA hizmet bedelleri, aksi yazılı olarak kararlaştırılmadıkça iade edilmez.",
        "Fuarın organizatör tarafından ertelenmesi, yerinin değiştirilmesi veya iptal edilmesi halinde organizatörün açıkladığı şartlar geçerlidir.",
      ],
    },
    {
      number: 5,
      title: "MÜCBİR SEBEP",
      body: [
        "Doğal afet, savaş, salgın hastalık, resmî makam kararları, ulaşım engelleri, grev ve tarafların makul kontrolü dışında gelişen benzeri olaylar mücbir sebep kabul edilir. Mücbir sebep nedeniyle tarafların yükümlülüklerini yerine getirememesinden dolayı taraflara herhangi bir tazminat sorumluluğu yüklenmez.",
      ],
    },
    {
      number: 6,
      title: "BELGELER VE İLETİŞİM",
      body: [
        "Tarafların e-posta üzerinden yaptığı bildirimler ve onaylar yazılı bildirim niteliğindedir. Fuar krokisi, fiyat listesi, fuar takvimi, broşür, flyer, ödeme planı ve taraflarca onaylanan ek belgeler bu sözleşmenin tamamlayıcı parçalarıdır. Elektronik imza ile imzalanan PDF nüshalar asıl belge hükmündedir ve taraflar açısından aynı hukuki sonuçları doğurur.",
      ],
    },
    {
      number: 7,
      title: "TEKLİF VE YÜRÜRLÜK",
      body: [
        "Bu belge, tarafların yetkili temsilcileri tarafından imzalanıncaya kadar TEKLİF niteliğindedir. Belgenin her iki tarafça elektronik ortamda imzalanmasıyla SÖZLEŞME yürürlüğe girer. Belge elektronik ortamda gönderilecek, iletilen bağlantı üzerinden elektronik imza ile imzalanacak olup ayrıca basılı nüsha gönderilmeyecektir.",
      ],
    },
    {
      number: 8,
      title:
        "SORUMLULUĞUN SINIRLANDIRILMASI",
      body: [
        "EXPOVIA; organizatör, resmî kurumlar, konsolosluklar, nakliye firmaları, lojistik hizmet sağlayıcıları, gümrük idareleri veya diğer üçüncü kişilerin karar, işlem, gecikme veya kusurlarından kaynaklanabilecek doğrudan ya da dolaylı zararlardan sorumlu değildir. Katılımcının kâr kaybı, iş kaybı, fırsat kaybı veya benzeri dolaylı zararlarından EXPOVIA sorumlu tutulamaz.",
      ],
    },
    {
      number: 9,
      title: "UYUŞMAZLIKLAR",
      body: [
        "Uyuşmazlıklarda öncelikle taraflar arasında uzlaşma aranır. Uzlaşma sağlanamaması halinde Tekirdağ Mahkemeleri ve İcra Daireleri yetkilidir.",
      ],
    },
  ];

// EXPOVIA's own letterhead details are template placeholders in the
// source master document itself ({{expovia_merkez_adresi}}, etc.) — they
// were never filled in there either, and no "our own company" record
// model exists anywhere in this app to source them from. Left blank
// rather than guessed; see report section "Bilinen eksikler".
export const EXPOVIA_LEGAL_NAME =
  "EXPOVIA ULUSLARARASI FUARCILIK TEKNOLOJİ İÇ VE DIŞ TİCARET LTD. ŞTİ.";
