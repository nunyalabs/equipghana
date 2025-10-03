// Users and Roles Management Module for EQUIP Health Ghana
// =========================================================
// This module handles all user and role management functionality
// including creation, editing, deletion, permissions, and scope management

const UserManagement = {
    // Reference to main app (will be set during initialization)
    app: null,

    // Initialize the module with app reference
    init(appInstance) {
        this.app = appInstance;
    },

    // ==========================================
    // USER DISPLAY AND LISTING
    // ==========================================

    loadUsers() {
        if (!this.app.hasPermission('canManageUsers')) return;
        
        const container = document.getElementById('usersList');
        const isListView = this.app.viewStates.users === 'list';
        
        if (isListView) {
            container.innerHTML = this.app.data.users.map(user => this.renderUserListItem(user)).join('');
        } else {
            container.innerHTML = this.app.data.users.map(user => this.renderUserCard(user)).join('');
        }
    },

    renderUserListItem(user) {
        const role = this.app.data.roles.find(r => r.id === user.roleId);
        const roleName = role ? role.name : 'Unknown Role';
        const scopeText = user.scope && user.scope.type !== 'none' ? `${user.scope.type}: ${user.scope.value}` : 'Global';
        
        // Get register access info
        let registerText = 'All Registers';
        if (user.assignedRegisters && user.assignedRegisters.length > 0) {
            const registerCount = user.assignedRegisters.length;
            registerText = `${registerCount} Register${registerCount > 1 ? 's' : ''}`;
        }

        // Get CSO access info
        let csoText = '';
        if (user.assignedCSOs && user.assignedCSOs.length > 0) {
            const csoCount = user.assignedCSOs.length;
            csoText = `<br><i class="bi bi-building"></i> ${csoCount} CSO${csoCount > 1 ? 's' : ''} (${user.assignedCSOs.join(', ')})`;
        }

        // Get permission info
        let permissionText = '';
        if (user.permissions?.canManageRegisters || user.permissions?.canManageUsers) {
            const perms = [];
            if (user.permissions.canManageRegisters) perms.push('Registers');
            if (user.permissions.canManageUsers) perms.push('Users');
            permissionText = `<br><i class="bi bi-key"></i> Permissions: ${perms.join(', ')}`;
        }

        return `
            <div class="card-item">
                <div class="card-content">
                    <div class="card-title">
                        <i class="bi bi-person-circle"></i> ${user.username}
                        <span class="badge badge-admin" style="margin-left: 8px;">${roleName}</span>
                    </div>
                    <div class="card-meta">
                        <i class="bi bi-geo-alt"></i> ${scopeText}<br>
                        <i class="bi bi-clipboard-data"></i> ${registerText}${csoText}${permissionText}
                    </div>
                </div>
                ${user.id !== 1 ? `
                    <div class="card-actions">
                        <button class="btn btn-primary btn-sm" onclick="app.showEditUserModal(${user.id})">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="app.deleteUser(${user.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderUserCard(user) {
        const role = this.app.data.roles.find(r => r.id === user.roleId);
        const roleName = role ? role.name : 'Unknown Role';
        const scopeText = user.scope && user.scope.type !== 'none' ? `${user.scope.type}: ${user.scope.value}` : 'Global';
        
        // Get register access info
        let registerText = 'All Registers';
        if (user.assignedRegisters && user.assignedRegisters.length > 0) {
            const registerCount = user.assignedRegisters.length;
            registerText = `${registerCount} Register${registerCount > 1 ? 's' : ''}`;
        }

        // Get CSO access info
        let csoText = '';
        if (user.assignedCSOs && user.assignedCSOs.length > 0) {
            const csoCount = user.assignedCSOs.length;
            csoText = `<br><i class="bi bi-building"></i> ${csoCount} CSO${csoCount > 1 ? 's' : ''} (${user.assignedCSOs.join(', ')})`;
        }

        // Get permission info
        let permissionText = '';
        if (user.permissions?.canManageRegisters || user.permissions?.canManageUsers) {
            const perms = [];
            if (user.permissions.canManageRegisters) perms.push('Registers');
            if (user.permissions.canManageUsers) perms.push('Users');
            permissionText = `<br><i class="bi bi-key"></i> Permissions: ${perms.join(', ')}`;
        }

        return `
            <div class="card-item">
                <div class="card-title">
                    <i class="bi bi-person-circle"></i> ${user.username}
                </div>
                <div class="card-description">
                    <span class="badge badge-admin">${roleName}</span>
                </div>
                <div class="card-meta">
                    <i class="bi bi-geo-alt"></i> ${scopeText}<br>
                    <i class="bi bi-clipboard-data"></i> ${registerText}${csoText}${permissionText}
                </div>
                ${user.id !== 1 ? `
                    <div class="card-actions">
                        <button class="btn btn-primary btn-sm" onclick="app.showEditUserModal(${user.id})">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="app.deleteUser(${user.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ==========================================
    // USER CREATION
    // ==========================================

    showCreateUserModal() { 
        // Check if user has permission to manage users
        if (!this.app.hasPermission('canManageUsers')) {
            alert('You do not have permission to create users. Please contact an administrator.');
            return;
        }
        this.app.showModal('createUserModal');
        this.populateRoleSelect('newUserRole');
        this.initScopeSelection('new', null);
        this.populateRegisterCheckboxes('new', []);
        this.populateCSOCheckboxes('new', null, []);
    },

    createUser() {
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;
        const roleId = parseInt(document.getElementById('newUserRole').value, 10);

        const scope = this.getScopeFromSelection('new');

        if (!username || !password) {
            alert('Please fill in all fields');
            return;
        }

        if (this.app.data.users.find(u => u.username === username)) {
            alert('Username already exists');
            return;
        }

        const role = this.app.data.roles.find(r => r.id === roleId);
        if (role && role.maxScope && role.maxScope !== 'none') {
            const order = ['facility','subdistrict','district','zone','region','none'];
            const rank = lvl => order.indexOf(lvl);
            if (scope.type !== 'none' && rank(scope.type) > rank(role.maxScope)) {
                alert(`Selected scope (${scope.type}) exceeds role maximum (${role.maxScope}). Please choose a narrower scope.`);
                return;
            }
        }

        const selectedRegisters = this.getSelectedRegisters('new');
        let selectedCSOs = role?.allowCSO ? this.getSelectedCSOs('new') : null;
        // Auto-assign CSOs for region / zone managers
        let autoCSOs = [];
        if (role?.allowCSO && ['region','zone'].includes(scope.type)) {
            autoCSOs = this.computeCSOsForScope(scope);
        }
        const canManageRegisters = document.getElementById('newUserCanManageRegisters').checked || (role?.defaults?.canManageRegisters ?? false);
        const canManageUsers = document.getElementById('newUserCanManageUsers').checked || (role?.defaults?.canManageUsers ?? false);

        const user = {
            id: Date.now(),
            username,
            password,
            roleId,
            scope,
            assignedRegisters: selectedRegisters.length > 0 ? selectedRegisters : null,
            assignedCSOs: autoCSOs.length > 0 ? autoCSOs : (selectedCSOs && selectedCSOs.length > 0 ? selectedCSOs : (role?.allowCSO ? null : null)),
            permissions: { canManageRegisters, canManageUsers }
        };

        this.app.data.users.push(user);
        this.app.saveToStorage();
        alert('User created successfully!');
        this.app.closeModal('createUserModal');
        this.loadUsers();
    },

    // ==========================================
    // USER EDITING
    // ==========================================

    showEditUserModal(userId) {
        const user = this.app.data.users.find(u => u.id === userId);
        if (!user) return;

        this.app.editingUserId = userId;

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editPassword').value = ''; // Clear password field

        this.populateRoleSelect('editUserRole', user.roleId);
        this.initScopeSelection('edit', user.scope);
        this.populateRegisterCheckboxes('edit', user.assignedRegisters || []);
        const role = this.app.data.roles.find(r => r.id === user.roleId);
        const userDistrict = user.scope && user.scope.type === 'district' ? user.scope.value : null;
        if (role?.allowCSO) {
            const grp = document.getElementById('editUserCSOsGroup');
            if (grp) grp.style.display = 'block';
            this.populateCSOCheckboxes('edit', userDistrict, user.assignedCSOs || []);
        } else {
            const grp = document.getElementById('editUserCSOsGroup');
            if (grp) grp.style.display = 'none';
        }
        document.getElementById('editUserCanManageRegisters').checked = user.permissions?.canManageRegisters || false;
        document.getElementById('editUserCanManageUsers').checked = user.permissions?.canManageUsers || false;
        
        this.app.showModal('editUserModal');
    },

    saveUserChanges() {
        const userId = parseInt(document.getElementById('editUserId').value, 10);
        const newPassword = document.getElementById('editPassword').value;
        const newRole = document.getElementById('editUserRole').value;
        const scope = this.getScopeFromSelection('edit');
        const selectedRegisters = this.getSelectedRegisters('edit');
        const role = this.app.data.roles.find(r => r.id === parseInt(newRole,10));
        let selectedCSOs = role?.allowCSO ? this.getSelectedCSOs('edit') : null;
        let autoCSOs = [];
        if (role?.allowCSO && ['region','zone'].includes(scope.type)) {
            autoCSOs = this.computeCSOsForScope(scope);
        }
        const canManageRegisters = document.getElementById('editUserCanManageRegisters').checked || (role?.defaults?.canManageRegisters ?? false);
        const canManageUsers = document.getElementById('editUserCanManageUsers').checked || (role?.defaults?.canManageUsers ?? false);

        const userIndex = this.app.data.users.findIndex(u => u.id === userId);
        if (userIndex === -1) { alert('User not found!'); return; }

        if (newPassword) this.app.data.users[userIndex].password = newPassword;
        this.app.data.users[userIndex].roleId = parseInt(newRole, 10);
        this.app.data.users[userIndex].scope = scope;
        this.app.data.users[userIndex].assignedRegisters = selectedRegisters.length > 0 ? selectedRegisters : null;
    this.app.data.users[userIndex].assignedCSOs = autoCSOs.length > 0 ? autoCSOs : (selectedCSOs && selectedCSOs.length > 0 ? selectedCSOs : (role?.allowCSO ? null : null));
        this.app.data.users[userIndex].permissions = { canManageRegisters, canManageUsers };

        // If editing the current user, update the currentUser object as well
        if (this.app.currentUser && this.app.currentUser.id === userId) {
            this.app.currentUser = { ...this.app.data.users[userIndex] };
            localStorage.setItem('currentUser', JSON.stringify(this.app.currentUser));
        }

        this.app.saveToStorage();
        alert('User updated successfully!');
        this.app.closeModal('editUserModal');
        this.loadUsers();
    },

    // ==========================================
    // USER DELETION
    // ==========================================

    deleteUser(userId) {
        if (confirm('Are you sure you want to delete this user?')) {
            this.app.data.users = this.app.data.users.filter(u => u.id !== userId);
            this.app.saveToStorage();
            this.loadUsers();
        }
    },

    // ==========================================
    // REGISTER ASSIGNMENT
    // ==========================================

    populateRegisterCheckboxes(prefix, selectedRegisterIds = []) {
        const container = document.getElementById(`${prefix}UserRegisters`);
        if (!container) return;

        if (this.app.data.forms.length === 0) {
            container.innerHTML = `
                <div style="padding: 10px; text-align: center; color: #999;">
                    <i class="bi bi-inbox"></i> No registers available yet
                </div>
            `;
            return;
        }

        container.innerHTML = this.app.data.forms.map(form => `
            <div style="margin-bottom: 8px;">
                <label style="display: flex; align-items: center; cursor: pointer; padding: 6px; border-radius: 4px; transition: background 0.2s;" 
                       onmouseover="this.style.background='rgba(255,255,255,0.05)'" 
                       onmouseout="this.style.background='transparent'">
                    <input type="checkbox" 
                           class="${prefix}RegisterCheckbox" 
                           value="${form.id}"
                           ${selectedRegisterIds.includes(form.id) ? 'checked' : ''}
                           style="margin-right: 8px; cursor: pointer;">
                    <span>${form.name}</span>
                </label>
            </div>
        `).join('');
    },

    getSelectedRegisters(prefix) {
        const checkboxes = document.querySelectorAll(`.${prefix}RegisterCheckbox:checked`);
        return Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
    },

    // ==========================================
    // CSO ASSIGNMENT
    // ==========================================

    populateCSOCheckboxes(prefix, selectedDistrict, selectedCSOs = []) {
        const container = document.getElementById(`${prefix}UserCSOs`);
        if (!container) return;

        // If no district selected, show message
        if (!selectedDistrict) {
            container.innerHTML = `
                <div style="padding: 10px; text-align: center; color: #999;">
                    <i class="bi bi-info-circle"></i> Select a district first to see available CSOs
                </div>
            `;
            return;
        }

        // Find CSOs for the selected district
        const availableCSOs = this.app.csos
            .filter(item => item.district === selectedDistrict)
            .map(item => item.cso);

        // Remove duplicates and sort
        const uniqueCSOs = [...new Set(availableCSOs)].sort();

        if (uniqueCSOs.length === 0) {
            container.innerHTML = `
                <div style="padding: 10px; text-align: center; color: #999;">
                    <i class="bi bi-inbox"></i> No CSOs available for ${selectedDistrict}
                </div>
            `;
            return;
        }

        container.innerHTML = uniqueCSOs.map(cso => `
            <div style="margin-bottom: 8px;">
                <label style="display: flex; align-items: center; cursor: pointer; padding: 6px; border-radius: 4px; transition: background 0.2s;" 
                       onmouseover="this.style.background='rgba(255,255,255,0.05)'" 
                       onmouseout="this.style.background='transparent'">
                    <input type="checkbox" 
                           class="${prefix}CSOCheckbox" 
                           value="${cso}"
                           ${selectedCSOs.includes(cso) ? 'checked' : ''}
                           style="margin-right: 8px; cursor: pointer;">
                    <span>${cso}</span>
                </label>
            </div>
        `).join('');
    },

    getSelectedCSOs(prefix) {
        const checkboxes = document.querySelectorAll(`.${prefix}CSOCheckbox:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
    },

    // ==========================================
    // ROLE MANAGEMENT
    // ==========================================

    showCreateRoleModal() {
        if (!this.app.hasPermission('canManageUsers')) {
            alert('You do not have permission to create roles. Please contact an administrator.');
            return;
        }
        document.getElementById('newRoleName').value = '';
        this.app.showModal('createRoleModal');
    },

    createRole() {
        if (!this.app.hasPermission('canManageUsers')) {
            alert('You do not have permission to create roles.');
            return;
        }
        const name = document.getElementById('newRoleName').value.trim();
        const maxScope = document.getElementById('newRoleMaxScope')?.value || 'none';
        const allowCSO = document.getElementById('newRoleAllowCSO')?.checked ?? true;
        const defaultCanManageRegisters = document.getElementById('newRoleDefaultCanManageRegisters')?.checked ?? false;
        const defaultCanManageUsers = document.getElementById('newRoleDefaultCanManageUsers')?.checked ?? false;
        if (!name) { alert('Please enter a role name.'); return; }
        if (this.app.data.roles.find(r => r.name.toLowerCase() === name.toLowerCase())) { alert('A role with this name already exists.'); return; }
        this.app.data.roles.push({
            id: Date.now(),
            name,
            maxScope,
            allowCSO,
            defaults: { canManageRegisters: defaultCanManageRegisters, canManageUsers: defaultCanManageUsers }
        });
        this.app.saveToStorage();
        this.loadRoles();
        this.app.closeModal('createRoleModal');
    },

    loadRoles() {
        // Use permission-based gating instead of hard-coded admin role ID
        if (!this.app.hasPermission('canManageUsers')) return;
        const container = document.getElementById('rolesList');
        container.innerHTML = this.app.data.roles.map(role => `
            <div class="list-item">
                <span>${role.name}</span>
                ${!role.isDefault ? `<button class="btn btn-outline" style="width: auto; padding: 6px 12px;" onclick="app.deleteRole(${role.id})">Delete</button>` : '<span style="font-size: 12px; color: #6B7280;">Default</span>'}
            </div>
        `).join('');
    },

    deleteRole(roleId) {
        if (confirm('Are you sure you want to delete this role? Users with this role will need to be reassigned.')) {
            // Check if any users have this role
            const usersWithRole = this.app.data.users.filter(u => u.roleId === roleId);
            if (usersWithRole.length > 0) {
                alert(`Cannot delete this role. ${usersWithRole.length} user(s) are assigned to it. Please reassign them first.`);
                return;
            }
            this.app.data.roles = this.app.data.roles.filter(r => r.id !== roleId);
            this.app.saveToStorage();
            this.loadRoles();
        }
    },

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    populateRoleSelect(selectId, selectedId = null) {
        const select = document.getElementById(selectId);
        select.innerHTML = this.app.data.roles.map(role => 
            `<option value="${role.id}">${role.name}</option>`
        ).join('');
        if (selectedId) {
            select.value = selectedId;
        }
    },

    initScopeSelection(prefix, scope) {
        this.handleScopeChange(prefix, 'root', scope);
    },

    handleScopeChange(prefix, level, userScope = null) {
        // Canonical ordering from broad to narrow
        const levels = ['region', 'zone', 'district', 'subdistrict', 'facility'];
        // Mapping to facility object keys (note Sub-district key contains a hyphen)
        const facilityKeys = {
            region: 'Region',
            zone: 'Zone',
            district: 'District',
            subdistrict: 'Sub-district',
            facility: 'Facility'
        };

        let filtered = [...this.app.facilities];

        // Helper to get DOM id segment (remove hyphen for element id suffix)
        const domSuffix = lvl => facilityKeys[lvl].replace('-', '');

        // When initializing (level === 'root') we rebuild every dropdown top-down.
        const changedIndex = level === 'root' ? -1 : levels.indexOf(level);

        levels.forEach((lvl, idx) => {
            const selectEl = document.getElementById(`${prefix}User${domSuffix(lvl)}`);
            const groupEl = document.getElementById(`${prefix}User${domSuffix(lvl)}Group`);
            if (!selectEl) return; // safety

            // If we are past the changed level or doing root init, rebuild options
            if (level === 'root' || idx >= changedIndex) {
                // Recompute option set from current filtered context
                const key = facilityKeys[lvl];
                const opts = [...new Set(filtered.map(f => f[key]).filter(Boolean))].sort();

                // Preserve previously selected value only if still valid
                const prior = selectEl.value;
                const shouldPreselect = userScope && userScope.type === lvl ? userScope.value : (opts.includes(prior) ? prior : '');

                selectEl.innerHTML = `<option value="">-- Select ${key} --</option>` +
                    opts.map(o => `<option value="${o}" ${o === shouldPreselect ? 'selected' : ''}>${o}</option>`).join('');

                // Show group if there are options; hide otherwise (except Region which we always show)
                if (groupEl) {
                    if (lvl === 'region' || opts.length > 0) {
                        groupEl.style.display = 'block';
                    } else {
                        groupEl.style.display = 'none';
                    }
                }

                // If a selection is made at this level, narrow the filtered list for deeper levels
                if (selectEl.value) {
                    filtered = filtered.filter(f => f[key] === selectEl.value);
                }

                // Clear all deeper levels so they rebuild cleanly next iteration
                for (let j = idx + 1; j < levels.length; j++) {
                    const deeper = levels[j];
                    const deeperSelect = document.getElementById(`${prefix}User${domSuffix(deeper)}`);
                    if (deeperSelect) {
                        const deeperKey = facilityKeys[deeper];
                        deeperSelect.innerHTML = `<option value="">-- Select ${deeperKey} --</option>`;
                    }
                }
            } else {
                // For levels before the changed one, apply filtering chain
                if (selectEl.value) {
                    const key = facilityKeys[lvl];
                    filtered = filtered.filter(f => f[key] === selectEl.value);
                }
            }
        });

        // Update CSO choices whenever district selection context changes
        const districtSelect = document.getElementById(`${prefix}UserDistrict`); // DOM id uses 'District'
        if (districtSelect) {
            this.populateCSOCheckboxes(prefix, districtSelect.value, userScope ? userScope.assignedCSOs : []);
        }
        const roleSelect = document.getElementById(prefix === 'new' ? 'newUserRole' : 'editUserRole');
        const role = roleSelect ? this.app.data.roles.find(r => r.id === parseInt(roleSelect.value,10)) : null;
        const csoGroup = document.getElementById(prefix === 'new' ? 'newUserCSOsGroup' : 'editUserCSOsGroup');
        if (csoGroup) csoGroup.style.display = role && role.allowCSO ? 'block' : 'none';
    },

    getScopeFromSelection(prefix) {
        const levels = ['facility', 'subdistrict', 'district', 'zone', 'region'];
        const levelCaps = ['Facility', 'Sub-district', 'District', 'Zone', 'Region'];

        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            const levelCap = levelCaps[i];
            const select = document.getElementById(`${prefix}User${levelCap.replace('-', '')}`);
            if (select && select.value) {
                return { type: level, value: select.value };
            }
        }

        return { type: 'none', value: null };
    },

    ensureRoleMetadata() {
        let changed = false;
        this.app.data.roles = this.app.data.roles.map(r => {
            if (r.maxScope || r.allowCSO !== undefined || r.defaults) return r;
            changed = true;
            return {
                ...r,
                maxScope: 'none',
                allowCSO: true,
                defaults: {
                    canManageRegisters: r.id === 1,
                    canManageUsers: r.id === 1
                }
            };
        });
        if (changed) this.app.saveToStorage();
    }
    ,
    // Compute all CSOs covered by a broader scope (region / zone)
    computeCSOsForScope(scope) {
        if (!scope || !scope.type) return [];
        if (!['region','zone'].includes(scope.type)) return [];
        // Gather districts within the scope
        const districts = [...new Set(this.app.facilities
            .filter(f => scope.type === 'region' ? f.Region === scope.value : f.Zone === scope.value)
            .map(f => f.District)
            .filter(Boolean))];
        if (!districts.length) return [];
        const csos = this.app.csos
            .filter(c => districts.includes(c.district))
            .map(c => c.cso);
        return [...new Set(csos)].sort();
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserManagement;
}
