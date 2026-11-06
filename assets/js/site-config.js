// Single public-site configuration. Values may be overridden by the
// Super Admin settings API at runtime; these are safe fallbacks.
window.ELPIS_CONFIG = {
  companyName: "Elpis Property Limited",
  tagline: "Your Future Begins With the Right Property.",
  whatsappNumber: "",
  phone: "",
  email: "",
  address: "",
  social: {
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: ""
  }
};

window.ELPIS_CONFIG_READY = fetch("/api/site-config", { credentials: "same-origin" })
  .then(function (res) { return res.ok ? res.json() : null; })
  .then(function (payload) {
    if (payload && payload.config) {
      var c = payload.config;
      window.ELPIS_CONFIG.companyName = c.companyName || window.ELPIS_CONFIG.companyName;
      window.ELPIS_CONFIG.tagline = c.tagline || window.ELPIS_CONFIG.tagline;
      window.ELPIS_CONFIG.whatsappNumber = c.whatsappNumber || "";
      window.ELPIS_CONFIG.phone = c.phone || "";
      window.ELPIS_CONFIG.email = c.email || "";
      window.ELPIS_CONFIG.address = c.address || "";
      window.ELPIS_CONFIG.social = c.social || window.ELPIS_CONFIG.social;
      window.ELPIS_CONFIG.branches = c.branches || [];
    }
    return window.ELPIS_CONFIG;
  })
  .catch(function () { return window.ELPIS_CONFIG; });
