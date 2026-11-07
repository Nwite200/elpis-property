// Elpis Property Limited public-site configuration.
// Replace branch addresses and contact details when Elpis supplies verified details.
window.ELPIS_CONFIG = {
  companyName: "Elpis Property Limited",
  tagline: "Your future begins with the right property",
  whatsappNumber: "",
  phone: "0805 070 0000",
  email: "hr@elpisproperty.org",
  address: "1st Building by the 1st Pedestrian Bridge along Government Secondary School 3 road, Nyanya, Abuja, FCT, Nigeria.",
  showDemoProperties: true,
  social: { facebook: "", instagram: "", twitter: "", linkedin: "" },
  branches: [
    {
      name: "Nyanya",
      city: "Nyanya",
      state: "Abuja, FCT",
      type: "Head Office",
      address: "1st Building by the 1st Pedestrian Bridge along Government Secondary School 3 road, Nyanya, Abuja, FCT, Nigeria.",
      phone: "0805 070 0000",
      isHeadOffice: true
    }
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
