(function(){
  "use strict";
  window.addEventListener("DOMContentLoaded",()=>window.PHOTOACOUSTIC.UI.init().catch(error=>{console.error(error);const status=document.getElementById("render-status");if(status)status.textContent="BOOT ERROR · "+String(error.message||error);}));
})();
