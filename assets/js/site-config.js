// Elpis Property Limited public-site configuration.
// Replace branch addresses and phone numbers when Elpis supplies verified details.
window.BLIS_CONFIG = {
  companyName: "Elpis Property Limited",
  tagline: "Your Trusted Real Estate Partner",
  whatsappNumber: "",
  phone: "",
  email: "hr@elpisproperty.org",
  address: "",
  social: { facebook: "", instagram: "", twitter: "", linkedin: "" },
  branches: [
    { name: "Head Office", city: "", state: "", type: "Corporate Headquarters", address: "Contact Elpis Property Limited for the verified address", phone: "", isHeadOffice: true },
    { name: "Ikeja Branch", city: "Ikeja", state: "Lagos State", type: "Mainland Branch", address: "Contact Elpis Property Limited for the verified address", phone: "", isHeadOffice: false },
    { name: "Ajah Branch", city: "Ajah", state: "Lagos State", type: "Island & Lekki Corridor Branch", address: "Contact Elpis Property Limited for the verified address", phone: "", isHeadOffice: false },
    { name: "Asaba Branch", city: "Asaba", state: "Delta State", type: "Delta State Regional Office", address: "Contact Elpis Property Limited for the verified address", phone: "", isHeadOffice: false },
    { name: "Ihama Branch", city: "Ihama", state: "Edo State", type: "Regional Branch", address: "Contact Elpis Property Limited for the verified address", phone: "", isHeadOffice: false },
    { name: "Obakhavba Branch", city: "Obakhavba", state: "Edo State", type: "Regional Branch", address: "Contact Elpis Property Limited for the verified address", phone: "", isHeadOffice: false }
  ]
};

window.ELPIS_CONFIG_READY = fetch("/api/site-config", { credentials: "same-origin" })
  .then(function (res) { return res.ok ? res.json() : null; })
  .then(function (payload) {
    if (payload && payload.config) {
      var c = payload.config;
      window.BLIS_CONFIG.companyName = c.companyName || window.BLIS_CONFIG.companyName;
      window.BLIS_CONFIG.tagline = c.tagline || window.BLIS_CONFIG.tagline;
      window.BLIS_CONFIG.whatsappNumber = c.whatsappNumber || window.BLIS_CONFIG.whatsappNumber;
      window.BLIS_CONFIG.phone = c.phone || window.BLIS_CONFIG.phone;
      window.BLIS_CONFIG.email = c.email || window.BLIS_CONFIG.email;
      window.BLIS_CONFIG.address = c.address || window.BLIS_CONFIG.address;
      window.BLIS_CONFIG.social = c.social || window.BLIS_CONFIG.social;
      if (Array.isArray(c.branches) && c.branches.length) window.BLIS_CONFIG.branches = c.branches;
    }
    return window.BLIS_CONFIG;
  })
  .catch(function () { return window.BLIS_CONFIG; });
