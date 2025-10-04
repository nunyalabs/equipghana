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
    input.accept = '.json,.equipbak,.equipsetup';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      try {
        const text = await file.text();
        const envelope = JSON.parse(text);
        if (!envelope.crypto || !envelope.crypto.ciphertext) { alert('File is not a valid encrypted backup.'); return; }
        
        // Check if this is a user setup package
        const isSetupPackage = envelope.meta?.module === 'EQUIP_USER_SETUP';
        
        const pass = prompt(isSetupPackage ? 'Enter the passphrase provided by your administrator:' : 'Enter passphrase to decrypt backup:');
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
        
        // Handle user setup package differently
        if (isSetupPackage && decoded.userCredentials) {
          await this.handleUserSetupImport(decoded);
          return;
        }
        
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
  // ADMIN USER SETUP EXPORT
  // =============================
  async exportUserSetup(userId) {
    if (!this.app.hasPermission('canManageUsers')) {
      alert('Only administrators can export user setup packages.');
      return;
    }
    
    const user = this.app.data.users.find(u => u.id === userId);
    if (!user) {
      alert('User not found.');
      return;
    }
    
    const tempPassword = this._generateTempPassword();
    const pass = prompt(`Enter a passphrase to encrypt the setup package for ${user.username}:\n\n(Share this passphrase separately with the user)`);
    if (!pass) {
      alert('Export cancelled - no passphrase.');
      return;
    }
    
    try {
      // Build user setup payload
      const payload = {
        userCredentials: {
          username: user.username,
          temporaryPassword: tempPassword,
          mustChangePassword: true
        },
        userProfile: {
          id: user.id,
          username: user.username,
          roleId: user.roleId,
          scope: user.scope,
          permissions: user.permissions,
          assignedRegisters: user.assignedRegisters || [],
          assignedCSOs: user.assignedCSOs || []
        },
        roles: this.app.data.roles.filter(r => r.id === user.roleId),
        forms: this.app.data.forms.filter(f => 
          !user.assignedRegisters || 
          user.assignedRegisters.length === 0 || 
          user.assignedRegisters.includes(f.id)
        ),
        setupInstructions: {
          step1: 'Import this file using the "Import Encrypted Backup" button',
          step2: 'Login with the temporary password',
          step3: 'You will be prompted to change your password',
          step4: 'After changing password, you can start using the system'
        }
      };
      
      const plaintext = new TextEncoder().encode(JSON.stringify(payload));
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await this._deriveKey(pass, salt);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
      
      const envelope = {
        meta: {
          module: 'EQUIP_USER_SETUP',
          version: this.version,
          exportedAt: new Date().toISOString(),
          exporter: this.app.currentUser.username,
          targetUser: user.username,
          includes: ['credentials', 'profile', 'roles', 'forms']
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
      a.download = `equip_user_setup_${user.username}_${new Date().toISOString().split('T')[0]}.equipsetup.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      
      // Show the temp password to admin
      alert(`User setup package exported successfully!\n\nTemporary Password: ${tempPassword}\n\nIMPORTANT:\n1. Share the .equipsetup.json file with ${user.username}\n2. Share the passphrase separately (securely)\n3. Share the temporary password: ${tempPassword}\n4. User must change password on first login`);
      
    } catch (e) {
      console.error(e);
      alert('Export failed: ' + e.message);
    }
  },

  async handleUserSetupImport(setupData) {
    // Check if user already exists
    const existingUser = this.app.data.users.find(u => u.username === setupData.userCredentials.username);
    
    if (existingUser) {
      // User exists - this is an update package
      const shouldUpdate = confirm(`User ${setupData.userCredentials.username} already exists. Do you want to merge the updated setup?\n\nThis will:\n- Update your permissions and assigned registers\n- Keep your current password\n- Preserve all your existing data`);
      
      if (!shouldUpdate) return;
      
      // Merge updates
      existingUser.roleId = setupData.userProfile.roleId;
      existingUser.scope = setupData.userProfile.scope;
      existingUser.permissions = setupData.userProfile.permissions;
      existingUser.assignedRegisters = setupData.userProfile.assignedRegisters;
      existingUser.assignedCSOs = setupData.userProfile.assignedCSOs;
      
      // Merge forms without duplicates
      let formsAdded = 0;
      if (setupData.forms) {
        setupData.forms.forEach(f => {
          if (!this.app.data.forms.find(existing => existing.id === f.id)) {
            this.app.data.forms.push(f);
            formsAdded++;
          }
        });
      }
      
      this.app.saveToStorage();
      alert(`Setup updated successfully!\n\n- Profile updated\n- ${formsAdded} new forms added\n- All your data preserved`);
      
      // Reload if current user
      if (this.app.currentUser && this.app.currentUser.username === setupData.userCredentials.username) {
        this.app.currentUser = existingUser;
        localStorage.setItem('currentUser', JSON.stringify(existingUser));
        this.app.updateUserInfo();
        this.app.loadDashboard();
      }
      
    } else {
      // New user - first time setup
      alert(`Welcome ${setupData.userCredentials.username}!\n\nYour account has been set up. You will now login with your temporary password and must change it.`);
      
      // Add user profile with temporary password
      const newUser = {
        ...setupData.userProfile,
        password: setupData.userCredentials.temporaryPassword,
        mustChangePassword: true
      };
      
      this.app.data.users.push(newUser);
      
      // Add roles if not exist
      if (setupData.roles) {
        setupData.roles.forEach(r => {
          if (!this.app.data.roles.find(existing => existing.id === r.id)) {
            this.app.data.roles.push(r);
          }
        });
      }
      
      // Add forms
      if (setupData.forms) {
        setupData.forms.forEach(f => {
          if (!this.app.data.forms.find(existing => existing.id === f.id)) {
            this.app.data.forms.push(f);
          }
        });
      }
      
      this.app.saveToStorage();
      
      // Prompt for login
      const shouldLogin = confirm('Setup complete! Would you like to login now?');
      if (shouldLogin) {
        this.app.showScreen('loginScreen');
        document.getElementById('loginUsername').value = setupData.userCredentials.username;
        document.getElementById('loginPassword').focus();
      }
    }
  },

  _generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
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
