// Elpis Property Limited public-site configuration.
// Replace branch addresses and phone numbers when Elpis supplies verified details.
window.ELPIS_CONFIG = {
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
      window.ELPIS_CONFIG.companyName = c.companyName || window.ELPIS_CONFIG.companyName;
      window.ELPIS_CONFIG.tagline = c.tagline || window.ELPIS_CONFIG.tagline;
      window.ELPIS_CONFIG.whatsappNumber = c.whatsappNumber || window.ELPIS_CONFIG.whatsappNumber;
      window.ELPIS_CONFIG.phone = c.phone || window.ELPIS_CONFIG.phone;
      window.ELPIS_CONFIG.email = c.email || window.ELPIS_CONFIG.email;
      window.ELPIS_CONFIG.address = c.address || window.ELPIS_CONFIG.address;
      window.ELPIS_CONFIG.social = c.social || window.ELPIS_CONFIG.social;
      if (Array.isArray(c.branches) && c.branches.length) window.ELPIS_CONFIG.branches = c.branches;
    }
    return window.ELPIS_CONFIG;
  })
  .catch(function () { return window.ELPIS_CONFIG; });
