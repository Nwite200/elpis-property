// Elpis Property Limited — main landing page logic.
document.addEventListener("DOMContentLoaded", async () => {
  if (window.ELPIS_CONFIG_READY) await window.ELPIS_CONFIG_READY;

  const headerSlot = document.getElementById("header-slot");
  const footerSlot = document.getElementById("footer-slot");
  if (headerSlot) headerSlot.innerHTML = Elpis.renderHeader("home");
  if (footerSlot) footerSlot.innerHTML = Elpis.renderFooter();
  Elpis.initNav();

  const c = Elpis.config();
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText("contactPhone", c.phone || "To be confirmed");
  setText("contactEmail", c.email || "Contact email not configured");
  setText("contactAddress", c.address || "Head office address to be confirmed");
  const waDigits = String(c.whatsappNumber || "").replace(/\D/g, "");
  const waConfigured = waDigits.length >= 10;
  setText("contactWhatsapp", waDigits.startsWith("234") && waDigits.length === 13
    ? `0${waDigits.slice(3, 6)} ${waDigits.slice(6, 9)} ${waDigits.slice(9)}`
    : (c.whatsappNumber || "Not yet configured"));

  const phoneLink = document.getElementById("contactPhoneLink");
  if (phoneLink) phoneLink.setAttribute("href", c.phone ? `tel:${String(c.phone).replace(/[^0-9+]/g, "")}` : "#contact");

  if (!waConfigured) {
    document.querySelectorAll(".wa-link, .contact-whatsapp-box, .wa-float").forEach((el) => {
      el.style.display = "none";
    });
  }

  const waBtn = document.getElementById("waBtn");
  if (waBtn) {
    waBtn.addEventListener("click", (e) => {
      e.preventDefault();
      Elpis.enquireWhatsApp("Hello Elpis Property Limited, I would like to speak with a property consultant regarding available opportunities.");
    });
  }

  // Branches
  const branchesGrid = document.getElementById("branchesGrid");
  if (branchesGrid) {
    const branches = Array.isArray(c.branches) && c.branches.length ? c.branches : [];
    branchesGrid.classList.toggle("branches-grid--single", branches.length <= 1);
    if (!branches.length) {
      branchesGrid.innerHTML = '<div class="branch-card"><div class="branch-badge">Configuration required</div><h3 class="branch-title">Branch offices</h3><p class="branch-address">Branch contact details are not configured yet.</p></div>';
    } else {
      branchesGrid.innerHTML = branches.map((b, index) => `
      <article class="branch-card fade-in ${b.isHeadOffice ? "branch-head-office" : ""}" style="--branch-index:${index}">
        <div class="branch-card-top">
          <span class="branch-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="branch-badge">${b.type || (b.isHeadOffice ? "Headquarters" : "Branch")}</span>
        </div>
        <h3 class="branch-title">${b.name || "Branch"}</h3>
        <p class="branch-location">${[b.city, b.state].filter(Boolean).join(", ") || "Location to be confirmed"}</p>
        <p class="branch-address">${b.address || "Verified address and contact details will be published here."}</p>
        <div class="branch-footer">
          ${b.phone ? `<a class="branch-action branch-phone" href="tel:${String(b.phone).replace(/[^0-9+]/g, "")}">${Elpis.icon("phone")} ${b.phone}</a>` : ""}
          ${waConfigured
            ? `<a class="branch-action wa-link" href="#" data-message="Hello Elpis Property, I would like to visit or speak with an agent at the ${b.name} office.">Contact office <span>→</span></a>`
            : `<a class="branch-action" href="#contact">Register interest <span>→</span></a>`}
        </div>
      </article>
    `).join("");
    }
  }

  // Properties
  let allProperties = [];
  try {
    const res = await fetch("/api/properties?limit=50");
    if (res.ok) {
      const data = await res.json();
      if (data && data.properties && data.properties.length > 0) {
        allProperties = data.properties.map((p) => ({
          id: String(p.id),
          slug: p.slug || (p.reference ? p.reference.toLowerCase() : String(p.id)),
          name: p.title || p.name,
          location: p.city ? `${p.city}, ${p.state || "Nigeria"}` : (p.state || "Nigeria"),
          branch: p.branch_name || "Head Office",
          category: p.category_name || "Residential",
          price: Number(p.sale_price || p.price || 0),
          units: p.available_units || 1,
          totalUnits: p.total_units || 10,
          bedrooms: p.bedrooms || 0,
          bathrooms: p.bathrooms || 0,
          size: p.size || p.land_size || "350 sqm",
          description: p.description || "",
          features: p.features ? (typeof p.features === "string" ? JSON.parse(p.features) : p.features) : [],
          status: p.status === "published" ? "Available" : (p.status || "Available"),
          featured: Boolean(p.is_featured),
          images: p.images && p.images.length ? p.images : [
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80"
          ],
          isDemo: false
        }));
      }
    }
  } catch (err) {
    // API not accessible; fall back to curated demonstration data.
  }

  const showDemo = !window.ELPIS_CONFIG || window.ELPIS_CONFIG.showDemoProperties === true;
  const staticProperties = allProperties.length === 0 && showDemo
    ? Elpis.properties().map((p) => ({ ...p, isDemo: true }))
    : [];
  const seen = new Set(allProperties.map((p) => `${String(p.name).toLowerCase()}|${String(p.location).toLowerCase()}`));
  for (const item of staticProperties) {
    const key = `${String(item.name).toLowerCase()}|${String(item.location).toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      allProperties.push(item);
    }
  }
  allProperties = allProperties.slice(0, 10);
  if (!allProperties.some((p) => String(p.category).toLowerCase() === "land")) {
    const land = staticProperties.find((p) => String(p.category).toLowerCase() === "land");
    if (land && !allProperties.some((p) => p.name === land.name)) {
      allProperties[allProperties.length - 1] = land;
    }
  }

  const grid = document.getElementById("propertyGrid");
  const resultsCounter = document.getElementById("resultsCounter");
  const searchInput = document.getElementById("searchInput");
  const locFilter = document.getElementById("locationFilter");
  const catFilter = document.getElementById("categoryFilter");
  const priceFilter = document.getElementById("priceFilter");
  const sortSelect = document.getElementById("sortSelect");
  const resetFiltersBtn = document.getElementById("resetFiltersBtn");

  const locations = [...new Set(allProperties.map((p) => p.branch || p.location.split(",")[0].trim()))].sort();
  const categories = [...new Set(allProperties.map((p) => p.category))].sort();

  if (locFilter) {
    locations.forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc;
      opt.textContent = loc;
      locFilter.appendChild(opt);
    });
  }

  if (catFilter) {
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      catFilter.appendChild(opt);
    });
  }

  const specIcon = (name) => Elpis.icon(name);

  function renderProperties() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    const loc = locFilter?.value || "";
    const cat = catFilter?.value || "";
    const priceRange = priceFilter?.value || "";
    const sort = sortSelect?.value || "";

    let items = allProperties.filter((p) => {
      const textMatch = !q || (p.name + " " + p.location + " " + p.branch + " " + (p.description || "")).toLowerCase().includes(q);
      const locMatch = !loc || p.branch === loc || p.location.toLowerCase().includes(loc.toLowerCase());
      const catMatch = !cat || p.category.toLowerCase() === cat.toLowerCase();

      let priceMatch = true;
      if (priceRange) {
        const [min, max] = priceRange.split("-").map(Number);
        if (max) {
          priceMatch = p.price >= min && p.price <= max;
        } else {
          priceMatch = p.price >= min;
        }
      }
      return textMatch && locMatch && catMatch && priceMatch;
    });

    if (sort === "price-asc") items.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") items.sort((a, b) => b.price - a.price);

    if (resultsCounter) {
      resultsCounter.textContent = `Showing ${items.length} of ${allProperties.length} ${items.length === 1 ? "property" : "properties"}`;
    }

    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⌂</div>
          <h3>No properties match your search</h3>
          <p>Try another search term, clear the location filter or broaden the price range.</p>
          <button class="btn btn-outline" id="clearFiltersBtn" style="margin-top:14px">Reset all filters</button>
        </div>
      `;
      const clrBtn = document.getElementById("clearFiltersBtn");
      if (clrBtn) clrBtn.addEventListener("click", resetAllFilters);
      return;
    }

    grid.innerHTML = items.map((p, index) => {
      const coverImg = (p.images && (typeof p.images[0] === "string" ? p.images[0] : p.images[0]?.url)) || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80";
      const featureTags = (p.features || []).slice(0, 2).map((f) => `<span class="feat-tag">${f}</span>`).join("");
      const moreCount = (p.features && p.features.length > 2) ? `<span class="feat-tag feat-more">+${p.features.length - 2}</span>` : "";
      const statusClass = p.status ? p.status.toLowerCase().replace(/\s+/g, "-") : "available";
      const specLine = [
        p.bedrooms ? `<span>${specIcon("home")} ${p.bedrooms} bed</span>` : "",
        p.bathrooms ? `<span>${specIcon("key")} ${p.bathrooms} bath</span>` : "",
        p.size ? `<span>${specIcon("land")} ${p.size}</span>` : ""
      ].filter(Boolean).join("");

      return `
        <article class="property-card fade-in" style="--card-index:${index}">
          <div class="property-image-wrap">
            <img src="${coverImg}" alt="${p.name}" loading="lazy" class="property-img" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'">
            <div class="card-badges-top">
              <span class="status-badge status-${statusClass}">${p.status || "Available"}</span>
              ${p.featured ? '<span class="status-badge badge-featured">Featured</span>' : ""}
              ${p.isDemo ? '<span class="status-badge badge-gray" title="Demonstration listing">Sample</span>' : ""}
            </div>
            <div class="card-badges-bottom">
              <span class="category-pill">${p.category}</span>
              <span class="property-ref">EP · ${String(p.id).replace(/[^0-9A-Za-z]/g, "").slice(-4).toUpperCase()}</span>
            </div>
            <div class="card-hover-line"></div>
          </div>

          <div class="property-card-body">
            <div class="prop-location">
              ${specIcon("pin")} ${p.location} <span class="prop-location-sep">/</span> ${p.branch}
            </div>

            <h3 class="prop-title"><a href="property.html?id=${encodeURIComponent(p.id)}">${p.name}</a></h3>
            <p class="prop-desc">${p.description ? p.description.slice(0, 112) + "…" : ""}</p>

            <div class="prop-spec-row">${specLine}</div>

            <div class="prop-features-list">
              ${featureTags}
              ${moreCount}
            </div>

            <div class="prop-pricing-row">
              <div class="price-box">
                <span class="price-lbl">From</span>
                <span class="price-amt">${Elpis.money(p.price)}</span>
              </div>
              <div class="units-box">
                <span class="units-val">${p.units} available</span>
                <span class="units-lbl">of ${p.totalUnits || 10} units</span>
              </div>
            </div>

            <div class="prop-actions-row">
              <a href="property.html?id=${encodeURIComponent(p.id)}" class="btn btn-card-details">View details <span>→</span></a>
              <a href="#" class="btn btn-card-enquire wa-link" data-message="Hello Elpis Property Limited, I am interested in ${p.name} located at ${p.location}, listed at ${Elpis.money(p.price)}. Please provide more details.">
                Enquire
              </a>
            </div>
          </div>
        </article>
      `;
    }).join("");

    grid.querySelectorAll(".wa-link").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const msg = a.getAttribute("data-message") || "Hello Elpis Property Limited, I would like to make an enquiry.";
        Elpis.enquireWhatsApp(msg);
      });
    });

    Elpis.observeFade();
  }

  function resetAllFilters() {
    if (searchInput) searchInput.value = "";
    if (locFilter) locFilter.value = "";
    if (catFilter) catFilter.value = "";
    if (priceFilter) priceFilter.value = "";
    if (sortSelect) sortSelect.value = "";
    renderProperties();
  }

  if (searchInput) searchInput.addEventListener("input", renderProperties);
  if (locFilter) locFilter.addEventListener("change", renderProperties);
  if (catFilter) catFilter.addEventListener("change", renderProperties);
  if (priceFilter) priceFilter.addEventListener("change", renderProperties);
  if (sortSelect) sortSelect.addEventListener("change", renderProperties);
  if (resetFiltersBtn) resetFiltersBtn.addEventListener("click", resetAllFilters);

  renderProperties();

  // Hero search
  const heroSearchBtn = document.getElementById("heroSearchBtn");
  if (heroSearchBtn) {
    heroSearchBtn.addEventListener("click", () => {
      const heroLoc = document.getElementById("heroLocation");
      const heroCat = document.getElementById("heroCategory");
      const heroPrice = document.getElementById("heroPrice");
      if (locFilter) locFilter.value = heroLoc?.value || "";
      if (catFilter) catFilter.value = heroCat?.value || "";
      if (priceFilter) priceFilter.value = heroPrice?.value || "";
      renderProperties();
      document.getElementById("properties")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Collection tiles
  document.querySelectorAll("[data-filter-category]").forEach((tile) => {
    tile.addEventListener("click", () => {
      if (catFilter) catFilter.value = tile.getAttribute("data-filter-category") || "";
      if (searchInput) searchInput.value = "";
      if (locFilter) locFilter.value = "";
      if (priceFilter) priceFilter.value = "";
      renderProperties();
      window.setTimeout(() => {
        document.getElementById("properties")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 40);
    });
  });

  // Contact form
  const contactForm = document.getElementById("contactForm");
  const formSuccess = document.getElementById("formSuccess");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting enquiry…";
      }
      try {
        const res = await fetch("/api/public/enquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: document.getElementById("contactFullName").value.trim(),
            phone_number: document.getElementById("contactPhoneInput").value.trim(),
            email_address: document.getElementById("contactEmailInput").value.trim(),
            branch_name: document.getElementById("contactBranchSelect").value,
            message: document.getElementById("contactMessage").value.trim(),
            source: "Homepage contact form"
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Unable to submit your enquiry.");
        contactForm.style.display = "none";
        if (formSuccess) formSuccess.style.display = "block";
      } catch (error) {
        alert(error.message || "Unable to submit your enquiry. Please try again.");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalLabel;
        }
      }
    });
  }

  // Smooth in-page anchors
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#" || targetId === "#home") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerHeight = document.getElementById("siteHeader")?.offsetHeight || 76;
        const targetPos = targetEl.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({ top: targetPos, behavior: "smooth" });
      }
    });
  });

  Elpis.observeFade();
});
