/* ============================================================================
 *  RUNTIME DEMO — menjalankan kode backend Apps Script ASLI (*.gs) di browser
 *  dengan Spreadsheet tiruan (data disimpan di localStorage).
 *  File ini disisipkan otomatis ke docs/index.html oleh scripts/build_pages.py
 *  (tidak dipakai di Google Apps Script).
 * ========================================================================== */
window.GASDEMO = (function () {
  var KEY = 'rapor_merdeka_demo_v3', OWNER = 'pemilik@demo.sch.id';
  var writes = 0, sheets = {}, order = [], props = {}, cacheStore = {};

  function Sheet(name) { this.name = name; this.cells = []; }
  function grid(sh, r, c) { while (sh.cells.length < r) sh.cells.push([]); var row = sh.cells[r - 1]; while (row.length < c) row.push(''); return row; }
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.getLastRow = function () { var l = 0; this.cells.forEach(function (row, i) { if (row.some(function (v) { return v !== '' && v !== null && v !== undefined; })) l = i + 1; }); return l; };
  Sheet.prototype.getLastColumn = function () { return Math.max.apply(null, [0].concat(this.cells.map(function (r) { return r.length; }))); };
  Sheet.prototype.setFrozenRows = function () { };
  Sheet.prototype.deleteRow = function (r) { writes++; this.cells.splice(r - 1, 1); };
  Sheet.prototype.setConditionalFormatRules = function () { };
  Sheet.prototype.getRange = function (r, c, nr, nc) {
    var sh = this;
    if (typeof r === 'string') {
      var m = r.match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/), col = function (x) { return x.split('').reduce(function (a, ch) { return a * 26 + ch.charCodeAt(0) - 64; }, 0); };
      c = col(m[1]); nc = m[3] ? col(m[3]) - c + 1 : 1; var r1 = m[2] ? +m[2] : 1, r2 = m[4] ? +m[4] : (m[2] ? r1 : Math.max(sh.cells.length, 1)); r = r1; nr = r2 - r1 + 1;
    }
    nr = nr || 1; nc = nc || 1;
    var o = {
      getValues: function () { var out = []; for (var i = 0; i < nr; i++) { var row = grid(sh, r + i, c + nc - 1); out.push(row.slice(c - 1, c - 1 + nc).map(function (v) { return v === undefined ? '' : v; })); } return out; },
      setValues: function (v) { if (v.length !== nr || v[0].length !== nc) throw new Error('setValues dimensi salah di ' + sh.name); writes++; v.forEach(function (rowv, i) { var row = grid(sh, r + i, c + nc - 1); rowv.forEach(function (x, j) { row[c - 1 + j] = x; }); }); return o; },
      setValue: function (x) { writes++; for (var i = 0; i < nr; i++) { var row = grid(sh, r + i, c + nc - 1); for (var j = 0; j < nc; j++) row[c - 1 + j] = x; } return o; },
      setFormulas: function (v) { return o.setValues(v); },
      clearContent: function () { writes++; for (var i = 0; i < nr; i++) { var row = grid(sh, r + i, c + nc - 1); for (var j = 0; j < nc; j++) row[c - 1 + j] = ''; } return o; },
      getSheet: function () { return sh; }
    };
    ['setNumberFormats', 'setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor', 'setDataValidation', 'setNote'].forEach(function (k) { o[k] = function () { return o; }; });
    return o;
  };
  var ss = {
    getId: function () { return 'DEMO'; }, getName: function () { return 'Database Rapor (Demo)'; }, getUrl: function () { return '#'; },
    getSheetByName: function (n) { return sheets[n] || null; },
    insertSheet: function (n) { var s = new Sheet(n); sheets[n] = s; order.push(n); writes++; return s; },
    getSheets: function () { return order.map(function (n) { return sheets[n]; }); }, deleteSheet: function () { }, toast: function () { }
  };
  var SpreadsheetApp = {
    openById: function () { return ss; }, getActiveSpreadsheet: function () { return null; }, getActive: function () { return null; },
    newDataValidation: function () { return { requireValueInList: function () { return this; }, setAllowInvalid: function () { return this; }, build: function () { return {}; } }; },
    newConditionalFormatRule: function () { return { whenFormulaSatisfied: function () { return this; }, setBackground: function () { return this; }, setRanges: function () { return this; }, build: function () { return {}; } }; },
    getUi: function () { return {}; }
  };
  var PropertiesService = { getScriptProperties: function () { return { getProperty: function (k) { return props[k] === undefined ? null : props[k]; }, setProperty: function (k, v) { props[k] = String(v); writes++; } }; } };
  var LockService = { getScriptLock: function () { return { waitLock: function () { }, releaseLock: function () { } }; } };
  var Session = { getActiveUser: function () { return { getEmail: function () { return OWNER; } }; }, getEffectiveUser: function () { return { getEmail: function () { return OWNER; } }; }, getScriptTimeZone: function () { return 'Asia/Jakarta'; } };
  var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function utf8(str) { return unescape(encodeURIComponent(String(str))).split('').map(function (c) { return c.charCodeAt(0); }); }
  function sha256(bytes) {
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], l = bytes.length, w = new Array(64), i, j;
    var m = bytes.slice(); m.push(0x80); while (m.length % 64 !== 56) m.push(0);
    var hi = Math.floor(l * 8 / 0x100000000), lo = (l * 8) >>> 0;
    m.push(hi >>> 24 & 255, hi >>> 16 & 255, hi >>> 8 & 255, hi & 255, lo >>> 24 & 255, lo >>> 16 & 255, lo >>> 8 & 255, lo & 255);
    function R(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (i = 0; i < m.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = (m[i + 4 * j] << 24) | (m[i + 4 * j + 1] << 16) | (m[i + 4 * j + 2] << 8) | m[i + 4 * j + 3];
      for (j = 16; j < 64; j++) { var s0 = R(w[j - 15], 7) ^ R(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = R(w[j - 2], 17) ^ R(w[j - 2], 19) ^ (w[j - 2] >>> 10); w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0; }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        var S1 = R(e, 6) ^ R(e, 11) ^ R(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[j] + w[j]) | 0, S0 = R(a, 2) ^ R(a, 13) ^ R(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = []; H.forEach(function (x) { out.push((x >> 24), (x >> 16), (x >> 8), x); }); return out.map(function (b2) { return (b2 << 24) >> 24; });   // byte bertanda seperti Apps Script
  }
  var Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
    computeDigest: function (alg, str) { return sha256(utf8(str)); },
    getUuid: function () { var h = '0123456789abcdef', o = ''; for (var i = 0; i < 36; i++) o += (i === 8 || i === 13 || i === 18 || i === 23) ? '-' : h[Math.floor(Math.random() * 16)]; return o; },
    formatDate: function (d, tz, f) { var p = function (n) { return String(n).padStart(2, '0'); }, x = new Date(d.getTime() + 7 * 3600e3), s = x.getUTCFullYear() + '-' + p(x.getUTCMonth() + 1) + '-' + p(x.getUTCDate()), t = p(x.getUTCHours()) + ':' + p(x.getUTCMinutes()) + ':' + p(x.getUTCSeconds()); return f.indexOf('HH') >= 0 ? (f.indexOf("'T'") >= 0 ? s + 'T' + t : s + ' ' + t) : s; }
  };
  var CacheService = { getScriptCache: function () { return {
    get: function (k) { var e = cacheStore[k]; if (!e) return null; if (e.x < Date.now()) { delete cacheStore[k]; return null; } return e.v; },
    put: function (k, v, sec) { cacheStore[k] = { v: String(v), x: Date.now() + (sec || 600) * 1000 }; writes++; },
    remove: function (k) { delete cacheStore[k]; writes++; }
  }; } };
  var Logger = { log: function () { } };
  var ScriptApp = { getProjectTriggers: function () { return []; }, newTrigger: function () { return { timeBased: function () { return { everyDays: function () { return { atHour: function () { return { create: function () { } }; } }; } }; } }; }, deleteTrigger: function () { } };
  var DriveApp = {}, HtmlService = {};

  /*__GAS__*/

  var API = { /*__API__*/ };

  function save() { try { var cells = {}; order.forEach(function (n) { cells[n] = sheets[n].cells; }); localStorage.setItem(KEY, JSON.stringify({ order: order, cells: cells, props: props, cache: cacheStore })); } catch (e) { } }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (!raw) return false; var d = JSON.parse(raw); sheets = {}; order = d.order; props = d.props || {}; cacheStore = d.cache || {}; order.forEach(function (n) { var s = new Sheet(n); s.cells = d.cells[n]; sheets[n] = s; }); return true; } catch (e) { return false; }
  }
  function bootstrap() {
    sheets = {}; order = []; cacheStore = {}; props = { SPREADSHEET_ID: 'DEMO' }; _mem = {}; _logBuf = [];
    _mem.ss = ss; buildStructure_(ss); seedDemo_(); syncMK_(); flushLog_(); _mem = {};
    // admin contoh + guru contoh kedua
    var r = setupConnect('', 'admin', 'admin123', 'Administrator'); if (!r.ok) console.warn(r.error);
    var tk = login('admin', 'admin123').token; _mem = {}; _logBuf = [];
    var g = rpc(tk, 'saveAkun', [{ nama_guru: 'Guru Contoh', nip: '', username: 'guru', peran: 'Guru', status: 'Aktif', password: 'guru123' }]); if (!g.ok) console.warn(g.error);
    _mem = {}; _logBuf = []; save();
  }
  var PUBLIC = { getPublicInfo: 1, login: 1, setupConnect: 1 };
  return {
    init: function () { if (!load()) bootstrap(); },
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) { } bootstrap(); },
    call: function (fn, args) {
      var f = PUBLIC[fn] ? API[fn] : (fn === 'rpc' ? API.rpc : null);
      if (!f) throw new Error('Fungsi tidak dikenal: ' + fn);
      _mem = {}; _logBuf = []; var before = writes, r = f.apply(null, args || []);
      if (writes !== before) save();
      return r === undefined ? r : JSON.parse(JSON.stringify(r));
    }
  };
})();
