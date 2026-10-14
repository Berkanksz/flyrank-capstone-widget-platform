(function () {
  const currentScript = document.currentScript;
  const widgetId = currentScript ? currentScript.getAttribute("data-widget-id") : null;
  const apiBase = currentScript ? (currentScript.getAttribute("data-api-base") || "http://localhost:3000") : "http://localhost:3000";

  if (!widgetId) {
    console.error("[FlyRank Widget] Missing data-widget-id attribute on script tag.");
    return;
  }

  // Fetch widget configuration with caching
  fetch(`${apiBase}/v1/widgets/${widgetId}/config`)
    .then((res) => {
      if (!res.ok) throw new Error(`Widget config error: ${res.status}`);
      return res.json();
    })
    .then((config) => {
      renderWidget(config, apiBase);
    })
    .catch((err) => {
      console.error("[FlyRank Widget] Failed to load config:", err);
    });

  function renderWidget(config, apiBase) {
    const container = document.createElement("div");
    container.id = `flyrank-widget-${config.id}`;
    container.style.cssText = `
      max-width: 420px;
      margin: 20px auto;
      padding: 24px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      background: #ffffff;
      color: #1e293b;
    `;

    let fieldsHtml = "";
    config.fields.forEach((f) => {
      fieldsHtml += `
        <div style="margin-bottom: 14px;">
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #475569;">
            ${f.label} ${f.required ? '<span style="color: #ef4444;">*</span>' : ''}
          </label>
          <input
            type="${f.type || 'text'}"
            name="${f.name}"
            ${f.required ? 'required' : ''}
            style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;"
          />
        </div>
      `;
    });

    container.innerHTML = `
      <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 700; color: #0f172a;">${config.title}</h3>
      <form id="flyrank-form-${config.id}">
        <!-- Honeypot spam defense field hidden from real humans -->
        <input type="text" name="_website_hp" style="display:none !important;" tabindex="-1" autocomplete="off" />
        ${fieldsHtml}
        <button
          type="submit"
          style="width: 100%; padding: 11px; background: ${config.color || '#2563eb'}; color: #ffffff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;"
        >
          ${config.button_text || 'Submit'}
        </button>
        <div id="flyrank-msg-${config.id}" style="margin-top: 12px; font-size: 13px; display: none;"></div>
      </form>
    `;

    document.body.appendChild(container);

    const form = document.getElementById(`flyrank-form-${config.id}`);
    const msgEl = document.getElementById(`flyrank-msg-${config.id}`);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new FormData(form);
      const payloadData = {};
      let honeypotVal = "";

      formData.forEach((val, key) => {
        if (key === "_website_hp") {
          honeypotVal = val;
        } else {
          payloadData[key] = val;
        }
      });

      fetch(`${apiBase}/v1/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widget_id: config.id,
          _website_hp: honeypotVal,
          data: payloadData,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            msgEl.textContent = "Thank you! Your submission has been received.";
            msgEl.style.color = "#16a34a";
            msgEl.style.display = "block";
            form.reset();
          } else {
            msgEl.textContent = data.message || "Failed to submit.";
            msgEl.style.color = "#dc2626";
            msgEl.style.display = "block";
          }
        })
        .catch((err) => {
          msgEl.textContent = "Network error. Please try again.";
          msgEl.style.color = "#dc2626";
          msgEl.style.display = "block";
        });
    });
  }
})();
