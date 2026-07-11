(function startApplication(S) {
  "use strict";

  window.addEventListener("DOMContentLoaded", async () => {
    try {
      const workbench = new S.UI.Workbench();
      S.workbench = workbench;
      await workbench.initialize();
      S.ready = true;
      document.documentElement.dataset.appStatus = "ready";
    } catch (error) {
      console.error(error);
      document.documentElement.dataset.appStatus = "error";
      const region = document.getElementById("toast-region");
      if (region) {
        const notice = document.createElement("div");
        notice.className = "toast error";
        notice.textContent = "SPECTRAL could not start: " + (error.message || String(error));
        region.appendChild(notice);
      }
    }
  });
})(window.SPECTRAL);
