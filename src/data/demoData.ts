export const companies = [
  {
    id: "atlas-mining",
    name: "Atlas Mining",
    contact: "Mehmet Kaya",
    role: "Purchasing Director",

    country: "Türkiye",
    city: "İstanbul",

    sectorIds: ["mining"],
    productGroupIds: ["mining-machinery", "drilling-equipment"],
    exhibitionInterestIds: ["dubai-mining-2027", "kazakhstan-mining-2027"],

    sector: "Mining Equipment",
    fair: "Dubai Mining",
    interest: "24 m² booth",

    relationship: "Strong",
    status: "active",

    lastContact: "Yesterday",
    nextAction: "Prepare revised quotation",

    opportunities: [
      {
        id: "opp-001",
        exhibition: "Dubai Mining 2027",
        stage: "Negotiation",
        status: "Active",
        plannedSqm: 24,
        nextAction: "Prepare revised quotation",
      },
      {
        id: "opp-002",
        exhibition: "Kazakhstan Mining 2027",
        stage: "Discovery",
        status: "Warm",
        plannedSqm: 0,
        nextAction: "Send exhibition calendar",
      },
    ],
  },

  {
    id: "anatolia-mining",
    name: "Anatolia Mining",
    contact: "Ahmet Kaya",
    role: "Export Manager",

    country: "Türkiye",
    city: "Ankara",

    sectorIds: ["mining"],
    productGroupIds: ["mining-machinery"],
    exhibitionInterestIds: ["mining-turkiye-2027"],

    sector: "Mining Machinery",
    fair: "Mining Türkiye 2027",
    interest: "Information package",

    relationship: "Warm",
    status: "lead",

    lastContact: "08 Jul",
    nextAction: "Follow-up call",

    opportunities: [],
  },

  {
    id: "geotech",
    name: "GeoTech Solutions",
    contact: "Selin Demir",
    role: "International Sales",

    country: "Türkiye",
    city: "İzmir",

    sectorIds: ["mining"],
    productGroupIds: ["geology-tech"],
    exhibitionInterestIds: ["dubai-mining-2027"],

    sector: "Geology Tech",
    fair: "Dubai Mining",
    interest: "Distributor visitors",

    relationship: "New",
    status: "lead",

    lastContact: "No recent contact",
    nextAction: "First outreach",

    opportunities: [],
  },
];

export const timeline = [
  {
    icon: "📞",
    title: "Call",
    date: "08 Jul",
    text: "Customer requested a revised 24 m² Dubai Mining quotation.",
  },
  {
    icon: "✉️",
    title: "Information sent",
    date: "08 Jul",
    text: "Floor plan, price list and participation conditions were sent.",
  },
  {
    icon: "➡️",
    title: "Next step",
    date: "Today",
    text: "Prepare revised quotation and ask about sponsorship interest.",
  },
];

export const workQueue = [
  "Prepare revised quotation",
  "Attach Dubai Mining floor plan",
  "Include sponsorship visibility option",
  "Set follow-up for tomorrow",
];