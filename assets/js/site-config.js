// Elpis Property Limited public-site configuration.
// Replace branch addresses and contact details when Elpis supplies new verified details.
window.ELPIS_CONFIG = {
  companyName: "Elpis Property Limited",
  tagline: "Your future begins with the right property",
  whatsappNumber: "2349168630710",
  phone: "0805 289 9920",
  email: "hr@elpisproperty.org",
  address: "102, Ihama Road, GRA, Benin City",
  showDemoProperties: true,
  social: { facebook: "", instagram: "", twitter: "", linkedin: "" },
  branches: [
    { name: "Head Office", city: "Benin City", state: "Edo State", type: "Corporate Headquarters", address: "102, Ihama Road, GRA, Benin City", phone: "0805 289 9920", isHeadOffice: true },
    { name: "Ikeja", city: "Ikeja", state: "Lagos State", type: "Mainland Branch", address: "Plot 40, Adegbola Street, Anifowose, Ikeja", phone: "0805 289 9920", isHeadOffice: false },
    { name: "Ajah", city: "Ajah", state: "Lagos State", type: "Island & Lekki Corridor", address: "Fladek Plaza, Ado Road, Ajah", phone: "0805 289 9920", isHeadOffice: false },
    { name: "Asaba", city: "Asaba", state: "Delta State", type: "Delta Regional Office", address: "Plot 2, Ikukaiwe Street, Asaba", phone: "0807 389 1911", isHeadOffice: false },
    { name: "Ihama", city: "Benin City", state: "Edo State", type: "GRA Branch", address: "102, Ihama Road, GRA, Benin City", phone: "0807 389 3946", isHeadOffice: false },
    { name: "Obakhavbaye", city: "Benin City", state: "Edo State", type: "Commercial Office", address: "13, Obakhavbaye Street, off Oba Market Road, Benin City", phone: "0805 289 9920", isHeadOffice: false }
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
