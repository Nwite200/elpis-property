// Elpis Property Limited — reusable public-site components and utilities.
window.Elpis = window.Elpis || {};

Elpis.money = function (n) {
  if (n === undefined || n === null || isNaN(n)) return "₦0";
  return "₦" + Number(n).toLocaleString("en-NG");
};

Elpis.config = function () {
  return window.ELPIS_CONFIG || {};
};

Elpis.properties = function () {
  return window.ELPIS_PROPERTIES || window.BLIS_PROPERTIES || [];
};

Elpis.branches = function () {
  return window.ELPIS_BRANCHES || window.BLIS_BRANCHES || [];
};

Elpis.findProperty = function (idOrSlug) {
  if (!idOrSlug) return null;
  const list = Elpis.properties();
  return list.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null;
};

Elpis.whatsappLink = function (msg) {
  const c = Elpis.config();
  const num = String(c.whatsappNumber || "").replace(/\D/g, "");
  if (!num) return null;
  const text = msg || "Hello Elpis Property Limited, I would like to make an enquiry regarding your properties.";
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
};

Elpis.enquireWhatsApp = function (msg) {
  const url = Elpis.whatsappLink(msg);
  if (!url) {
    alert("WhatsApp contact has not been configured yet. Please use the phone or email shown on the site.");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

Elpis.icon = function (name, className) {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M7 17 17 7M8 7h9v9"/>',
    pin: '<path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    phone: '<path d="M6.5 3.5h3l1.5 4-2 1.3a13 13 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17.8 17.8 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l2-4.2A8.5 8.5 0 1 1 21 11.5Z"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.5 7.5-9.5V6L12 3Z"/><path d="m8.7 12 2.2 2.2 4.4-4.4"/>',
    building: '<path d="M4 21V5l8-3v19M12 21V9l8 3v9M2 21h20"/><path d="M7 8h2M7 12h2M7 16h2M16 13h1M16 17h1"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10"/><path d="M9 21v-6h6v6"/>',
    land: '<path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-5h6v5"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="m7 15 4-5 3 3 5-7"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l2 2M17 6l2 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    quote: '<path d="M9 11H5a4 4 0 0 1 4-4v10H5v-4M19 11h-4a4 4 0 0 1 4-4v10h-4v-4"/>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'
  };
  return `<svg class="ui-icon ${className || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
};

Elpis.renderHeader = function (activePage) {
  const c = Elpis.config();
  const isDetails = activePage === "property-detail";
  const homePrefix = isDetails ? "index.html" : "";

  return `
  <div class="topline">
    <div class="container topline-inner">
      <div class="topline-left">
        <span class="topline-signal"></span>
        <span>Verified property ownership &amp; investment across Nigeria</span>
      </div>
      <div class="topline-right">
        <span class="topline-note">Property advisory and client support</span>
        <span class="topline-sep">/</span>
        <a href="${c.phone ? "tel:" + c.phone : "#contact"}" class="topline-contact">${c.phone || "Speak with an advisor"} ${Elpis.icon("arrowUp")}</a>
      </div>
    </div>
  </div>

  <header class="site-header" id="siteHeader">
    <div class="container nav-wrapper">
      <a class="brand" href="${homePrefix}#home" aria-label="${c.companyName} Home">
        <img src="assets/images/elpis-property-logo-original.png" alt="${c.companyName}" class="brand-img">
      </a>

      <nav class="nav-links" id="navLinks" aria-label="Primary navigation">
        <a href="${homePrefix}#home" class="${activePage === "home" ? "active" : ""}">Home</a>
        <a href="${homePrefix}#properties" class="${activePage === "properties" ? "active" : ""}">Portfolio</a>
        <a href="${homePrefix}#categories">Collections</a>
        <a href="${homePrefix}#about" class="${activePage === "about" ? "active" : ""}">About</a>
        <a href="${homePrefix}#investment">Investment</a>
        <a href="${homePrefix}#branches" class="${activePage === "branches" ? "active" : ""}">Branches</a>
        <a href="${homePrefix}#contact" class="${activePage === "contact" ? "active" : ""}">Contact</a>
        <a href="client-login.html" class="nav-login-mobile">Client Portal</a>
      </nav>

      <div class="nav-actions">
        <a href="client-login.html" class="btn btn-login" title="Client Portal">Client Portal</a>
        <a href="${homePrefix}#properties" class="btn btn-gold btn-nav-cta">Explore Portfolio ${Elpis.icon("arrow")}</a>
        <button class="menu-btn" id="menuBtn" aria-label="Toggle navigation menu" aria-expanded="false">
          <span class="menu-bar"></span>
          <span class="menu-bar"></span>
          <span class="menu-bar"></span>
        </button>
      </div>
    </div>
  </header>`;
};

Elpis.renderFooter = function () {
  const c = Elpis.config();
  const currentYear = new Date().getFullYear();
  const waDigits = String(c.whatsappNumber || "").replace(/\D/g, "");
  const waDisplay = waDigits.startsWith("234") && waDigits.length === 13
    ? `0${waDigits.slice(3, 6)} ${waDigits.slice(6, 9)} ${waDigits.slice(9)}`
    : c.whatsappNumber;

  return `
  <footer class="site-footer">
    <div class="footer-topline">
      <div class="container footer-topline-inner">
        <span>Private advisory. Institutional discipline.</span>
        <a href="#contact">Start a conversation ${Elpis.icon("arrow")}</a>
      </div>
    </div>
    <div class="container footer-content">
      <div class="footer-grid">
        <div class="footer-col footer-col-brand">
          <a href="index.html#home" class="footer-brand-link">
            <img class="footer-logo footer-logo-official" src="assets/images/elpis-property-logo-original.png" alt="${c.companyName}">
          </a>
          <p class="footer-bio">
            A Nigerian real-estate house built around verified titles, transparent pricing and enduring client relationships.
          </p>
          <div class="footer-trust-badge">
            <img src="assets/images/elpis-property-logo-original.png" alt="" class="footer-seal" width="26" height="26">
            <span>Registered &amp; verified property advisory</span>
          </div>
        </div>

        <div class="footer-col">
          <h4 class="footer-heading">Explore</h4>
          <ul class="footer-links-list">
            <li><a href="index.html#properties">Property portfolio</a></li>
            <li><a href="index.html#categories">Collections</a></li>
            <li><a href="index.html#investment">Investment approach</a></li>
            <li><a href="index.html#about">About Elpis</a></li>
            <li><a href="index.html#why">Why Elpis</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4 class="footer-heading">Our Branches</h4>
          <ul class="footer-links-list">
            <li><a href="index.html#branches">Nyanya — Abuja, FCT</a></li>
          </ul>
        </div>

        <div class="footer-col footer-col-contact">
          <h4 class="footer-heading">Contact</h4>
          <div class="footer-contact-items">
            <a class="footer-contact-row" href="${c.phone ? "tel:" + String(c.phone).replace(/[^0-9+]/g, "") : "#contact"}">
              <span class="footer-contact-icon">${Elpis.icon("phone")}</span>
              <span><small>Telephone</small><strong>${c.phone || "Contact the team"}</strong></span>
            </a>
            <a class="footer-contact-row" href="${c.whatsappNumber ? Elpis.whatsappLink() : "#contact"}" ${c.whatsappNumber ? 'target="_blank" rel="noopener"' : ""}>
              <span class="footer-contact-icon">${Elpis.icon("chat")}</span>
              <span><small>WhatsApp</small><strong>${waDisplay || "Not yet configured"}</strong></span>
            </a>
            <a class="footer-contact-row" href="${c.email ? "mailto:" + c.email : "#contact"}">
              <span class="footer-contact-icon">${Elpis.icon("mail")}</span>
              <span><small>Email</small><strong>${c.email || "Email the team"}</strong></span>
            </a>
            <div class="footer-contact-row">
              <span class="footer-contact-icon">${Elpis.icon("pin")}</span>
              <span><small>Headquarters</small><strong>${c.address || "Address to be confirmed"}</strong></span>
            </div>
          </div>
          <div class="footer-social-strip">
            <a href="${c.social?.facebook || "#"}" target="_blank" rel="noopener" aria-label="Facebook">FB</a>
            <a href="${c.social?.instagram || "#"}" target="_blank" rel="noopener" aria-label="Instagram">IG</a>
            <a href="${c.social?.twitter || "#"}" target="_blank" rel="noopener" aria-label="Twitter">X</a>
            <a href="${c.social?.linkedin || "#"}" target="_blank" rel="noopener" aria-label="LinkedIn">IN</a>
            ${c.whatsappNumber ? `<a href="#" class="footer-wa-pill" id="footerWaBtn">WhatsApp ${Elpis.icon("arrowUp")}</a>` : ""}
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <div class="footer-bottom-left">
          <span>&copy; ${currentYear} ${c.companyName}. All rights reserved.</span>
          <span class="demo-tag">Property imagery and demonstration listings are illustrative until verified records are published.</span>
        </div>
        <div class="footer-bottom-right">
          <a href="login.html" class="client-portal-link">Client &amp; Staff Portal ${Elpis.icon("arrow")}</a>
        </div>
      </div>
    </div>
  </footer>`;
};

Elpis.initNav = function () {
  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");
  const siteHeader = document.getElementById("siteHeader");

  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      menuBtn.classList.toggle("open", isOpen);
      menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.classList.toggle("nav-open", isOpen);
    });

    document.querySelectorAll("#navLinks a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuBtn.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      });
    });
  }

  let lastScroll = window.scrollY;
  window.addEventListener("scroll", () => {
    if (!siteHeader) return;
    const current = window.scrollY;
    siteHeader.classList.toggle("scrolled", current > 24);
    siteHeader.classList.toggle("header-hidden", current > lastScroll && current > 220);
    lastScroll = current;
  }, { passive: true });

  const footerWa = document.getElementById("footerWaBtn");
  if (footerWa) {
    footerWa.addEventListener("click", (e) => {
      e.preventDefault();
      Elpis.enquireWhatsApp("Hello Elpis Property Limited, I would like to make an enquiry about your properties.");
    });
  }

  document.querySelectorAll(".wa-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const msg = a.getAttribute("data-message") || "Hello Elpis Property Limited, I would like to make a property enquiry.";
      Elpis.enquireWhatsApp(msg);
    });
  });
};

Elpis.observeFade = function () {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".fade-in").forEach((el) => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: "0px 0px -40px 0px"
  });

  document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
};
