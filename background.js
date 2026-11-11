/**
 * default host value
 */
let host = "http://127.0.0.1:9666";
let targetOrigin = "http://127.0.0.1:9666";
let sethost = true;
let bypasscsp = true;
let pause = false;
let basicAuthHeader = false;

/**
 * filter settings url
 */
const redirectFilter = {
    urls: [
        "*://127.0.0.1/*",
        "*://localhost/*"        
    ],
    types: ["main_frame", "sub_frame", "script", "object", "xmlhttprequest"]
};
let headerFilter;

const cspFilter = {
    urls: ["*://*/*"],
    types: ["main_frame", "sub_frame"]
};

const CSP_HEADERS = [
    "content-security-policy",
    "content-security-policy-report-only",
    "x-content-security-policy",
    "x-webkit-csp"
];

// Determine extraInfoSpec flags safely across Chrome and Firefox
const sendHeadersExtraInfoSpec = ["blocking", "requestHeaders"];
if (chrome.webRequest.OnBeforeSendHeadersOptions && chrome.webRequest.OnBeforeSendHeadersOptions.EXTRA_HEADERS) {
    sendHeadersExtraInfoSpec.push("extraHeaders");
}

const responseHeadersExtraInfoSpec = ["blocking", "responseHeaders"];
if (chrome.webRequest.OnHeadersReceivedOptions && chrome.webRequest.OnHeadersReceivedOptions.EXTRA_HEADERS) {
    responseHeadersExtraInfoSpec.push("extraHeaders");
}


/**
 * load settings from chrome
 */
chrome.storage.sync.get({ settings: 
{
    targethost: "127.0.0.1",
    targetport: "9666",
    targetproto: "http",
    sethostheader: true,
    bypasscsp: true,
    pause: false,
    targetuser: "",
    targetpasswd: ""
} 
}, function(storage) {
    host = storage.settings.targetproto + "://" + storage.settings.targethost + ":" + storage.settings.targetport;
    pause = storage.settings.pause;
    sethost = storage.settings.sethostheader;
    bypasscsp = storage.settings.bypasscsp !== undefined ? storage.settings.bypasscsp : true;

    const targetUrl = new URL(host);
    targetOrigin = targetUrl.origin;
    headerFilter = {
        urls: [targetUrl.protocol + "//" + targetUrl.hostname + "/*"],
        types: redirectFilter.types
    };
        
    //build auth header (must not be used without https)
    if (storage.settings.targetproto == "https" && storage.settings.targetuser.length > 0 && storage.settings.targetpasswd.length > 0 ){

        basicAuthHeader = {
            name: "Authorization",
            value: "Basic " + btoa( storage.settings.targetuser + ":" +  storage.settings.targetpasswd )        
        }
    }

    if (!pause) install_listeners();
});


/**
 * Check URL for port 9666 and replace host
 * otherwise return original url
 * @param {*} details 
 */
function checkurl(details) {
  if (pause) return;

  const match = details.url.match(/^([\S]*:9666)([\S]*)/);

  if (match) {
    const newUrl = host + match[2];
    if (details.url !== newUrl) {
      return { redirectUrl: newUrl };
    }
  }
}

/**
 * Add Basic Auth Header if request is made via https
 * @param {*} details 
 */
 function checkHeader(details){
    if (pause) return;

    const requestUrl = new URL(details.url);
    if (targetOrigin !== requestUrl.origin) return;

    let headers = details.requestHeaders || [];

    if (sethost) {
        // Remove any existing Host header first
        headers = headers.filter(header =>
          header.name.toLowerCase() !== "host"
        );

        // Add our forced Host header (127.0.0.1:9666)
        headers.push({
          name: "Host",
          value: "127.0.0.1:9666"
        });
    }

    //if proto==https and authentication is set
    //add basic auth
     if (basicAuthHeader) {
        headers.push(basicAuthHeader);
    }

    return { requestHeaders: headers };
}

/**
 * Strip Content Security Policy (CSP) headers to allow redirecting Click'n'Load
 * requests to configured host without CSP violations
 * @param {*} details 
 */
function checkResponseHeaders(details) {
    if (pause || !bypasscsp) return;

    if (!details.responseHeaders) return;

    const requestUrl = new URL(details.url);
    if (targetOrigin !== requestUrl.origin) return;

    const headers = details.responseHeaders.filter(header =>
        !CSP_HEADERS.includes(header.name.toLowerCase())
    );

    return { responseHeaders: headers };
}

/**
 * install onBeforeRequestListener, onBeforeSendHeadersListener, and onHeadersReceivedListener after settings are loaded
 */
function install_listeners(){
    chrome.webRequest.onBeforeRequest.addListener(checkurl, redirectFilter, ["blocking"]);
    chrome.webRequest.onBeforeSendHeaders.addListener(checkHeader, headerFilter, sendHeadersExtraInfoSpec);
    chrome.webRequest.onHeadersReceived.addListener(checkResponseHeaders, cspFilter, responseHeadersExtraInfoSpec);
}

/**
 * if paused remove onBeforeRequestListener, onBeforeSendHeadersListener, and onHeadersReceivedListener
 */
 function remove_listeners(){
    chrome.webRequest.onBeforeRequest.removeListener( checkurl );
    chrome.webRequest.onBeforeSendHeaders.removeListener( checkHeader );
    chrome.webRequest.onHeadersReceived.removeListener( checkResponseHeaders );
}


/**
 * save pause state
 * @param {boolean} pause must be set to true or false 
 */
// Saves options to chrome.storage.sync.
function save_options(pause, callback) {
    chrome.storage.sync.set({
        pause: pause
    }, function() {
        // Update icon status
        callback();
    });
}


/**
 * set extension icon to pause state
 */
function disableBrowserAction(){
    chrome.browserAction.setIcon({path:"images/icon_status_pause.png"});
    remove_listeners();
}
/**
 * set extension icon to normal state
 */
function enableBrowserAction(){
    chrome.browserAction.setIcon({path:"images/icon_status.png"});
    install_listeners();
}

/**
 * on click handler for extension icon
 * switch state, store and update icon
 */
function updateState( ){
    
        if(pause === false){
            pause = true;
            save_options(pause,function(){
                disableBrowserAction();
            });
        }else{
            pause = false;
            save_options(pause,function(){
                enableBrowserAction();
            });   
        }
}

/**
 * register extension icon on click handler
 */
chrome.browserAction.onClicked.addListener(updateState);
