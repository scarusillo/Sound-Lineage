/* Fill these in after deploying backend/ (see backend/DEPLOY.md). Leave api empty to keep the diary on this device. */
window.SL_CONFIG = window.SL_CONFIG || {
  api: "",          // ApiUrl output, e.g. https://abc123.execute-api.us-east-1.amazonaws.com
  authDomain: "",   // AuthDomain output, e.g. https://sound-lineage-auth.auth.us-east-1.amazoncognito.com
  clientId: "",     // ClientId output
  redirect: "https://scarusillo.github.io/Sound-Lineage/",
};
if (!window.SL_CONFIG.api) window.SL_CONFIG = null;
