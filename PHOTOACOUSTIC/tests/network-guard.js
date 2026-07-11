(function(root){
  "use strict";
  const attempts=root.__PA_NETWORK_ATTEMPTS__=[];
  function blocked(kind){return function(){attempts.push(kind);throw new Error("Network API blocked by test guard: "+kind);};}
  function replace(target,key,kind){try{Object.defineProperty(target,key,{configurable:true,writable:true,value:blocked(kind)});}catch(_){/* CSP remains the final network boundary if a browser locks this API. */}}
  if(typeof root.fetch==="function")replace(root,"fetch","fetch");
  if(typeof root.XMLHttpRequest==="function")replace(root,"XMLHttpRequest","XMLHttpRequest");
  if(typeof root.WebSocket==="function")replace(root,"WebSocket","WebSocket");
  if(typeof root.EventSource==="function")replace(root,"EventSource","EventSource");
  if(root.navigator&&typeof root.navigator.sendBeacon==="function")replace(root.navigator,"sendBeacon","sendBeacon");
  if(root.navigator&&root.navigator.serviceWorker&&typeof root.navigator.serviceWorker.register==="function")replace(root.navigator.serviceWorker,"register","serviceWorker.register");
})(window);
