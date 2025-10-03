// Data Portability Module for EQUIP Health Ghana
// Handles encrypted export, import & merge of users, roles, forms, and records
// Uses WebCrypto (AES-GCM + PBKDF2) for passphrase-based encryption

const DataPortability = {
  app: null,
  version: 1,

  init(appInstance) {
    this.app = appInstance;
  },

  // =============================
  // PUBLIC API (delegated via app)
  // =============================
  async exportEncrypted() {
    if (!this.app.currentUser) { alert('You must be logged in.'); return; }
    const pass = prompt('Enter passphrase to encrypt backup (keep it safe):');
    if (!pass) { alert('Export cancelled - no passphrase.'); return; }
    try {
      const payload = this.buildExportPayload();
      const plaintext = new TextEncoder().encode(JSON.stringify(payload));
      const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await this._deriveKey(pass, salt);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
      const envelope = {
        meta: {
          module: 'EQUIP_DATA_BACKUP',
          version: this.version,
          exportedAt: new Date().toISOString(),
          exporter: this.app.currentUser.username,
          scope: this.app.currentUser.scope || { type: 'none', value: null },
          includes: Object.keys(payload)
        },
        crypto: {
          alg: 'AES-GCM',
          kdf: 'PBKDF2',
          iterations: 120000,
          salt: this._toBase64(salt),
          iv: this._toBase64(iv),
          ciphertext: this._toBase64(ciphertext)
        }
      };
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `equip_encrypted_backup_${new Date().toISOString().split('T')[0]}.equipbak.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
      alert('Encrypted backup exported successfully.');
    } catch (e) {
      console.error(e); alert('Export failed: ' + e.message);
    }
  },

  async importEncryptedAndMerge() {
    if (!this.app.currentUser) { alert('Login required.'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.equipbak';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      try {
        const text = await file.text();
        const envelope = JSON.parse(text);
        if (!envelope.crypto || !envelope.crypto.ciphertext) { alert('File is not a valid encrypted backup.'); return; }
        const pass = prompt('Enter passphrase to decrypt backup:');
        if (!pass) { alert('Import cancelled.'); return; }
  const salt = this._fromBase64(envelope.crypto.salt);
  const iv = this._fromBase64(envelope.crypto.iv);
  const ciphertext = this._fromBase64(envelope.crypto.ciphertext);
  const key = await this._deriveKey(pass, salt, envelope.crypto.iterations);
        let plaintext;
        try {
          plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        } catch (err) {
          alert('Decryption failed (wrong passphrase or corrupt file).'); return;
        }
        const decoded = JSON.parse(new TextDecoder().decode(plaintext));
        const summary = this.mergeData(decoded);
        this.app.saveToStorage();
        alert(`Merge complete. Added: Users ${summary.usersAdded}, Forms ${summary.formsAdded}, Records ${summary.recordsAdded}. Skipped duplicates: ${summary.usersSkipped} users, ${summary.formsSkipped} forms, ${summary.recordsSkipped} records.`);
      } catch (e) {
        console.error(e); alert('Import error: ' + e.message);
      }
    };
    input.click();
  },

  // =============================
  // DATA SELECTION (SCOPED EXPORT)
  // =============================
  buildExportPayload() {
    const user = this.app.currentUser;
    const payload = {};

    // Roles & users only if current user can manage users
    if (this.app.hasPermission('canManageUsers')) {
      payload.roles = this.app.data.roles;
      // For scoped users, restrict export to users within their scope
  payload.users = this.app.data.users.filter(u => this._isWithinScope(u.scope, user.scope));
    } else {
      // Export only self
      payload.users = [this.app.data.users.find(u => u.id === user.id)].filter(Boolean);
    }

    // Forms
    let accessibleFormIds;
    if (user.assignedRegisters && user.assignedRegisters.length > 0) {
      accessibleFormIds = new Set(user.assignedRegisters);
    } else {
      accessibleFormIds = new Set(this.app.data.forms.map(f => f.id));
    }
    payload.forms = this.app.data.forms.filter(f => accessibleFormIds.has(f.id));

    // Records: include only those for accessible forms & (if not admin) either submittedBy self or allowed by assigned list
    payload.records = this.app.data.records.filter(r => accessibleFormIds.has(r.formId) && (
      this.app.hasPermission('canManageRegisters') || r.submittedBy === user.username
    ));

    return payload;
  },

  // =============================
  // MERGE LOGIC
  // =============================
  mergeData(imported) {
    const summary = { usersAdded: 0, usersSkipped: 0, formsAdded: 0, formsSkipped: 0, recordsAdded: 0, recordsSkipped: 0 };
    const currentUser = this.app.currentUser;

    // Merge roles only if manager
    if (imported.roles && this.app.hasPermission('canManageUsers')) {
      imported.roles.forEach(r => {
        if (!this.app.data.roles.find(x => x.id === r.id || x.name.toLowerCase() === r.name.toLowerCase())) {
          this.app.data.roles.push(r);
        }
      });
    }

    // Merge users
    if (imported.users) {
      imported.users.forEach(u => {
        // Skip if username already exists
        if (this.app.data.users.find(x => x.username === u.username)) { summary.usersSkipped++; return; }
        // Only admins / managers can import additional users
        if (!this.app.hasPermission('canManageUsers')) { summary.usersSkipped++; return; }
        // Scope constraint: imported user scope must be within current user's scope (unless current user has global scope none)
  if (!this._isWithinScope(u.scope, currentUser.scope)) { summary.usersSkipped++; return; }
        // Avoid id collision
        if (this.app.data.users.find(x => x.id === u.id)) { u.id = Date.now() + Math.floor(Math.random()*1000); }
        this.app.data.users.push(u);
        summary.usersAdded++;
      });
    }

    // Build form id mapping in case of collisions
    const existingFormIds = new Set(this.app.data.forms.map(f => f.id));

    const formIdRemap = new Map();

    if (imported.forms) {
      imported.forms.forEach(f => {
        // Permission: need register management OR already assigned access (can't import new forms otherwise)
        if (!this.app.hasPermission('canManageRegisters')) { summary.formsSkipped++; return; }
        if (existingFormIds.has(f.id)) {
          // If same name and same number of fields treat as duplicate, skip
            const existing = this.app.data.forms.find(x => x.id === f.id);
            if (existing && existing.name === f.name) { summary.formsSkipped++; return; }
            const newId = Date.now() + Math.floor(Math.random()*1000);
            formIdRemap.set(f.id, newId);
            f.id = newId;
        }
        this.app.data.forms.push(f);
        summary.formsAdded++;
      });
    }

    // Merge records
    if (imported.records) {
      imported.records.forEach(r => {
        // Remap formId if changed
        if (formIdRemap.has(r.formId)) r.formId = formIdRemap.get(r.formId);
        // Validate form exists & accessible
        const form = this.app.data.forms.find(f => f.id === r.formId);
        if (!form) { summary.recordsSkipped++; return; }
        // Permission gating: if user cannot manage registers, only allow own submissions (rare for merge) -> skip
        if (!this.app.hasPermission('canManageRegisters') && r.submittedBy !== currentUser.username) { summary.recordsSkipped++; return; }
        // Deduplicate by id
        if (this.app.data.records.find(x => x.id === r.id)) { summary.recordsSkipped++; return; }
        this.app.data.records.push(r);
        summary.recordsAdded++;
      });
    }

    return summary;
  },

  // =============================
  // INTERNAL HELPERS
  // =============================
  async _deriveKey(passphrase, salt, iterations = 120000) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
  },

  _toBase64(uint8) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < uint8.length; i += chunk) {
      binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
    }
    return btoa(binary);
  },

  _fromBase64(b64) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  },

  _isWithinScope(childScope, parentScope) {
    // parentScope: the importing user's scope (what they are allowed to manage)
    // childScope: the entity being imported
    if (!parentScope || parentScope.type === 'none') return true; // global
    if (!childScope || childScope.type === 'none') return false; // cannot elevate to global
    const order = ['region','zone','district','subdistrict','facility'];
    const rank = lvl => order.indexOf(lvl);
    const pRank = rank(parentScope.type);
    const cRank = rank(childScope.type);
    // child must be deeper (>=) than parent OR exact same level & value within same lineage
    if (cRank < pRank) return false; // child broader than parent
    // If same level must match value
    if (cRank === pRank) return childScope.value === parentScope.value;
    // If deeper, ensure lineage containment (we only have value string; approximate by presence)
    // Without full hierarchy chain, allow deeper by default
    return true;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataPortability;
}
