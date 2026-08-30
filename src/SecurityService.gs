/**
 * SecurityService.gs — Enterprise Security, Rate Limiting, Input Sanitization & Access Guard
 * Digital Reporting System for Integrated Agriculture Company
 * 
 * Clean Architecture Layer: SECURITY / CROSS-CUTTING CONCERN
 * Responsibility: Enforces rate limiting, RBAC access guards, formula injection mitigation,
 * payload validation, and secure exception formatting across all API entry points.
 */

const SecurityService = {

  // Configuration Constants
  RATE_LIMITS: {
    AUTH: { maxAttempts: 5, windowSeconds: 900, name: 'Autentikasi & Akun' },        // 5 attempts per 15 minutes
    SUBMISSION: { maxAttempts: 30, windowSeconds: 60, name: 'Pengiriman Laporan' },   // 30 submissions per minute
    READ_QUERY: { maxAttempts: 120, windowSeconds: 60, name: 'Permintaan Data' },     // 120 reads per minute
    GENERAL: { maxAttempts: 60, windowSeconds: 60, name: 'Aktivitas Umum' }           // 60 requests per minute
  },

  MAX_PAYLOAD_BYTES: 15 * 1024 * 1024,      // 15 MB total payload
  MAX_PHOTO_BYTES: 5 * 1024 * 1024,         // 5 MB per photo
  ALLOWED_IMAGE_MIMES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],

  /**
   * =========================================================================
   * 1. RATE LIMITER (CacheService backed token / counter bucket)
   * =========================================================================
   */
  RateLimiter: {
    /**
     * Resolves caller unique fingerprint.
     * Uses active user email or anonymous session identifier.
     * @returns {string} Caller identifier
     */
    getCallerIdentifier: function() {
      let identifier = '';
      try {
        identifier = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
      } catch (e) {}

      if (!identifier) {
        try {
          identifier = (Session.getTemporaryActiveUserKey() || '').trim();
        } catch (e) {}
      }

      return identifier || 'anon_visitor';
    },

    /**
     * Enforces rate limiting on authentication and role management routes.
     * Max 5 attempts per 15 minutes (900 seconds).
     * @param {string} [customId]
     */
    checkAuthRateLimit: function(customId) {
      const id = customId || this.getCallerIdentifier();
      this.enforceRateLimit_('RL_AUTH_' + id, SecurityService.RATE_LIMITS.AUTH);
    },

    /**
     * Enforces rate limiting on report and form submissions.
     * Max 30 attempts per minute.
     * @param {string} [customId]
     */
    checkSubmissionRateLimit: function(customId) {
      const id = customId || this.getCallerIdentifier();
      this.enforceRateLimit_('RL_SUBMIT_' + id, SecurityService.RATE_LIMITS.SUBMISSION);
    },

    /**
     * Enforces rate limiting on read and analytics queries.
     * Max 120 attempts per minute.
     * @param {string} [customId]
     */
    checkReadRateLimit: function(customId) {
      const id = customId || this.getCallerIdentifier();
      this.enforceRateLimit_('RL_READ_' + id, SecurityService.RATE_LIMITS.READ_QUERY);
    },

    /**
     * Enforces rate limiting on general administrative endpoints.
     * Max 60 attempts per minute.
     * @param {string} [customId]
     */
    checkGeneralRateLimit: function(customId) {
      const id = customId || this.getCallerIdentifier();
      this.enforceRateLimit_('RL_GEN_' + id, SecurityService.RATE_LIMITS.GENERAL);
    },

    /**
     * Internal rate limit evaluator using Apps Script CacheService.
     * @param {string} cacheKey 
     * @param {{ maxAttempts: number, windowSeconds: number, name: string }} rule 
     * @private
     */
    enforceRateLimit_: function(cacheKey, rule) {
      try {
        const cache = CacheService.getScriptCache();
        if (!cache) return; // Fail open gracefully if CacheService is restricted

        const currentVal = cache.get(cacheKey);
        let count = 0;

        if (currentVal !== null && currentVal !== undefined) {
          count = parseInt(currentVal, 10) || 0;
        }

        if (count >= rule.maxAttempts) {
          const errMsg = `[429 Too Many Requests] Batas laju permintaan tercapai untuk ${rule.name}. Maksimum ${rule.maxAttempts} percobaan per ${Math.round(rule.windowSeconds / 60)} menit. Silakan tunggu beberapa saat.`;
          Logger.log(`SecurityService Rate Limit Breached: ${cacheKey} (Attempts: ${count}/${rule.maxAttempts})`);
          throw new Error(errMsg);
        }

        // Increment count with TTL window
        cache.put(cacheKey, String(count + 1), rule.windowSeconds);
      } catch (e) {
        if (e.message && e.message.includes('429 Too Many Requests')) {
          throw e;
        }
        Logger.log('SecurityService Notice: CacheService rate limit check warning: ' + e.toString());
      }
    },

    /**
     * Resets rate limit for a given key (useful after successful authentication or test suite).
     * @param {string} keyPrefix 
     * @param {string} [customId]
     */
    resetRateLimit: function(keyPrefix, customId) {
      try {
        const id = customId || this.getCallerIdentifier();
        const cache = CacheService.getScriptCache();
        if (cache) cache.remove(keyPrefix + id);
      } catch (e) {}
    }
  },

  /**
   * =========================================================================
   * 2. INPUT SANITIZER & FORMULA INJECTION NEUTRALIZER
   * =========================================================================
   */
  InputSanitizer: {
    /**
     * Neutralizes Spreadsheet Formula Injection (CWE-1236 / CSV Injection).
     * Prefixes malicious trigger characters (=, +, -, @, \t, \r, \n) with a single apostrophe (').
     * @param {any} val 
     * @returns {any} Sanitized value safe for Spreadsheet storage.
     */
    sanitizeForSpreadsheet: function(val) {
      if (val === null || val === undefined) return '';
      if (typeof val === 'number' || typeof val === 'boolean') return val;
      if (val instanceof Date) return val;

      if (Array.isArray(val)) {
        return val.map(item => this.sanitizeForSpreadsheet(item));
      }

      if (typeof val === 'object') {
        const sanitizedObj = {};
        for (const k in val) {
          if (Object.prototype.hasOwnProperty.call(val, k)) {
            sanitizedObj[this.sanitizeText(k, 100)] = this.sanitizeForSpreadsheet(val[k]);
          }
        }
        return sanitizedObj;
      }

      const strVal = String(val).trim();
      if (!strVal) return '';

      // Check if first character is a dangerous formula character
      const firstChar = strVal.charAt(0);
      if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@' || firstChar === '\t' || firstChar === '\r') {
        // Only prefix if not already single-quoted and not a valid standalone signed number (e.g. -15.5 or +100)
        if (!/^[+-]?\d+(\.\d+)?$/.test(strVal)) {
          return "'" + strVal;
        }
      }

      // Check for pipe commands (e.g. | or cmd)
      if (strVal.startsWith('|')) {
        return "'" + strVal;
      }

      return strVal;
    },

    /**
     * Sanitizes strings to prevent Cross-Site Scripting (XSS / CWE-79).
     * @param {string} str 
     * @returns {string} HTML-escaped string
     */
    sanitizeHtml: function(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\//g, '&#x2F;');
    },

    /**
     * General string sanitizer: trims, strips control characters, enforces length limit.
     * @param {any} val 
     * @param {number} [maxLen=2000]
     * @returns {string} Clean string
     */
    sanitizeText: function(val, maxLen = 2000) {
      if (val === null || val === undefined) return '';
      let str = String(val).trim();
      // Remove null bytes and non-printable control characters (except newline, tab, cr)
      str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      if (str.length > maxLen) {
        str = str.substring(0, maxLen);
      }
      return str;
    },

    /**
     * Validates and sanitizes email address.
     * @param {string} email 
     * @returns {string} Lowercase trimmed email
     */
    sanitizeEmail: function(email) {
      const clean = this.sanitizeText(email, 254).toLowerCase();
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!clean || !emailRegex.test(clean)) {
        throw new Error('Format alamat email tidak valid: ' + clean);
      }
      return clean;
    },

    /**
     * Masks phone number to protect personal data compliance (UU No. 27 Tahun 2022 PDP).
     * Example: '081234567890' -> '0812••••7890'.
     * @param {string|number} phone 
     * @returns {string} Masked phone number or '-'
     */
    maskPhoneNumber: function(phone) {
      if (!phone) return '-';
      const clean = String(phone).trim();
      if (!clean || clean === '-' || clean === 'null' || clean === 'undefined') return '-';
      const digits = clean.replace(/\D/g, '');
      if (digits.length <= 6) return '••••••';
      const prefix = digits.substring(0, 4);
      const suffix = digits.substring(digits.length - 4);
      return `${prefix}••••${suffix}`;
    },

    /**
     * Validates photo attachment metadata and size before upload.
     * @param {string} base64Data 
     * @param {string} mimeType 
     * @param {number} [maxBytes]
     * @returns {{ cleanBase64: string, mimeType: string }}
     */
    validatePhotoAttachment: function(base64Data, mimeType, maxBytes) {
      if (!base64Data) {
        throw new Error('Data gambar tidak boleh kosong.');
      }

      const limit = maxBytes || SecurityService.MAX_PHOTO_BYTES;
      const normalizedMime = (mimeType || 'image/jpeg').toLowerCase().trim();

      if (!SecurityService.ALLOWED_IMAGE_MIMES.includes(normalizedMime)) {
        throw new Error(`Format berkas '${normalizedMime}' tidak diizinkan. Gunakan format JPG, PNG, atau WEBP.`);
      }

      let cleanBase64 = String(base64Data);
      if (cleanBase64.indexOf(',') !== -1) {
        cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(',') + 1);
      }
      cleanBase64 = cleanBase64.replace(/\s/g, '');

      // Approximate byte size from base64 string length
      const approxBytes = Math.ceil((cleanBase64.length * 3) / 4);
      if (approxBytes > limit) {
        const sizeMb = (approxBytes / (1024 * 1024)).toFixed(2);
        const limitMb = (limit / (1024 * 1024)).toFixed(0);
        throw new Error(`Ukuran foto (${sizeMb} MB) melebihi batas maksimum (${limitMb} MB). Harap kompresi foto.`);
      }

      // Check base64 character validity
      if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
        throw new Error('Encoding base64 gambar tidak valid.');
      }

      return {
        cleanBase64: cleanBase64,
        mimeType: normalizedMime
      };
    }
  },

  /**
   * =========================================================================
   * 3. PAYLOAD VALIDATOR
   * =========================================================================
   */
  PayloadValidator: {
    /**
     * Rejects oversized incoming request payloads.
     * @param {any} payload 
     * @param {number} [maxBytes]
     */
    validatePayloadSize: function(payload, maxBytes) {
      if (!payload) return;
      const limit = maxBytes || SecurityService.MAX_PAYLOAD_BYTES;
      try {
        const serialized = JSON.stringify(payload);
        if (serialized && serialized.length > limit) {
          const sizeMb = (serialized.length / (1024 * 1024)).toFixed(2);
          const limitMb = (limit / (1024 * 1024)).toFixed(0);
          throw new Error(`[413 Payload Too Large] Ukuran data permintaan (${sizeMb} MB) melampaui batas server (${limitMb} MB).`);
        }
      } catch (e) {
        if (e.message && e.message.includes('413 Payload Too Large')) throw e;
      }
    },

    /**
     * Validates schema of operational report submissions.
     * @param {Object} payload 
     */
    validateOperationalPayload: function(payload) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload laporan operasional tidak valid atau kosong.');
      }

      this.validatePayloadSize(payload);

      // Validate required string lengths
      if (payload.idKaryawan) payload.idKaryawan = SecurityService.InputSanitizer.sanitizeText(payload.idKaryawan, 50).toUpperCase();
      if (payload.namaPic) payload.namaPic = SecurityService.InputSanitizer.sanitizeText(payload.namaPic, 150);
      if (payload.lokasiKegiatan) payload.lokasiKegiatan = SecurityService.InputSanitizer.sanitizeText(payload.lokasiKegiatan, 100);
      if (payload.jenisKegiatan) payload.jenisKegiatan = SecurityService.InputSanitizer.sanitizeText(payload.jenisKegiatan, 100);
      if (payload.kendala) payload.kendala = SecurityService.InputSanitizer.sanitizeText(payload.kendala, 3000);
      if (payload.upaya) payload.upaya = SecurityService.InputSanitizer.sanitizeText(payload.upaya, 3000);

      // Validate numeric fields if present
      if (payload.luasLahanHa !== undefined && payload.luasLahanHa !== null && payload.luasLahanHa !== '') {
        const val = Number(payload.luasLahanHa);
        if (isNaN(val) || val < 0) throw new Error('Nilai Luas Lahan (Ha) harus berupa angka positif.');
      }

      if (payload.volumePanen !== undefined && payload.volumePanen !== null && payload.volumePanen !== '') {
        const val = Number(payload.volumePanen);
        if (isNaN(val) || val < 0) throw new Error('Nilai Volume Panen harus berupa angka positif.');
      }

      if (payload.hargaSatuanRp !== undefined && payload.hargaSatuanRp !== null && payload.hargaSatuanRp !== '') {
        const val = Number(payload.hargaSatuanRp);
        if (isNaN(val) || val < 0) throw new Error('Nilai Harga Satuan (Rp) harus berupa angka positif.');
      }
    }
  },

  /**
   * =========================================================================
   * 4. ACCESS GUARD & RBAC ENFORCER
   * =========================================================================
   */
  AccessGuard: {
    /**
     * Asserts active visitor has Superadmin privileges ('both').
     */
    requireSuperadmin: function() {
      const role = AuthService.getUserRole();
      if (role !== 'both') {
        Logger.log(`SecurityService AccessGuard: Forbidden superadmin access attempt by: ${Session.getActiveUser().getEmail() || 'anonymous'}`);
        throw new Error('[403 Forbidden] Akses ditolak: Fitur ini hanya dapat diakses oleh Superadmin.');
      }
    },

    /**
     * Asserts active visitor has Admin or Superadmin privileges.
     */
    requireAdminOrSuperadmin: function() {
      const role = AuthService.getUserRole();
      if (role !== 'admin' && role !== 'both') {
        Logger.log(`SecurityService AccessGuard: Forbidden admin access attempt by: ${Session.getActiveUser().getEmail() || 'anonymous'}`);
        throw new Error('[403 Forbidden] Akses ditolak: Memerlukan hak akses Admin Operasional atau Superadmin.');
      }
    },

    /**
     * Asserts active visitor has Manager or Superadmin privileges.
     */
    requireManagerOrSuperadmin: function() {
      const role = AuthService.getUserRole();
      if (role !== 'manager' && role !== 'both') {
        Logger.log(`SecurityService AccessGuard: Forbidden manager access attempt by: ${Session.getActiveUser().getEmail() || 'anonymous'}`);
        throw new Error('[403 Forbidden] Akses ditolak: Memerlukan hak akses Manager Eksekutif atau Superadmin.');
      }
    },

    /**
     * Asserts active visitor is recognized authorized staff.
     */
    requireAuthorizedStaff: function() {
      const role = AuthService.getUserRole();
      if (!role) {
        Logger.log(`SecurityService AccessGuard: Unauthorized access attempt by: ${Session.getActiveUser().getEmail() || 'anonymous'}`);
        throw new Error('[401 Unauthorized] Akun Anda tidak memiliki otorisasi untuk mengakses data konsol internal.');
      }
    },

    /**
     * Sanitizes and masks sensitive error messages before sending to client.
     * Prevents internal path, sheet ID, or stack trace exposure.
     * @param {Error|any} err 
     * @returns {string} User-safe error message
     */
    maskSensitiveError: function(err) {
      if (!err) return 'Terjadi kesalahan pada server.';
      const rawMsg = err.message || err.toString() || 'Unknown server error';

      // Pass through user-facing validation and 4xx status messages
      if (rawMsg.startsWith('[4') || rawMsg.includes('wajib') || rawMsg.includes('tidak valid') || rawMsg.includes('Akses')) {
        return rawMsg;
      }

      // Log full internal error for developer inspection
      Logger.log('SecurityService Internal Error Captured: ' + (err.stack || rawMsg));

      // Return clean generic message
      return 'Gagal memproses permintaan: ' + SecurityService.InputSanitizer.sanitizeText(rawMsg, 150);
    }
  }
};
