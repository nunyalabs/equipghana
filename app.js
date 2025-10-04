// Main Application Object
const app = {
    currentUser: null,
    editingUserId: null,
    editingRecordId: null,
    currentForm: null,
    formFields: [],
    facilities: [],
    csos: [],
    
    // Initialize app and load data from memory
    async init() {
        await this.loadFacilities();
        await this.loadCSOs();
        this.loadFromStorage();
        // Removed automatic creation of hard-coded register templates.
        // Registers are now created manually or via Excel import only.
        
        // Initialize User Management module
        UserManagement.init(this);
        // Ensure any legacy roles are enriched with new metadata (maxScope, allowCSO, defaults)
        if (typeof UserManagement.ensureRoleMetadata === 'function') {
            UserManagement.ensureRoleMetadata();
        }
        // Initialize Forms / Registers module
        if (typeof FormsModule !== 'undefined') {
            FormsModule.init(this);
        } else {
            console.warn('FormsModule not found. Ensure forms.js is loaded before app.js');
        }
        // Initialize Data Portability module
        if (typeof DataPortability !== 'undefined') {
            DataPortability.init(this);
        } else {
            console.warn('DataPortability module not found. Ensure data-portability.js is loaded before app.js');
        }
        // Initialize Reports module
        if (typeof ReportsModule !== 'undefined') {
            ReportsModule.init(this);
            // Prepare default UI state
            ReportsModule.showReportUI();
        } else {
            console.warn('ReportsModule not found. Ensure report.js is loaded before app.js');
        }
        
        this.checkAuth();
        
        // Setup field type change listener
        const fieldType = document.getElementById('fieldType');
        if (fieldType) {
            fieldType.addEventListener('change', () => {
                const choicesGroup = document.getElementById('choicesGroup');
                const showChoices = ['select_one', 'select_multiple'].includes(fieldType.value);
                choicesGroup.style.display = showChoices ? 'block' : 'none';
            });
        }
    },

    // Removed createRegisterFromTemplate / initializePrebuiltRegisters (legacy template system)

    // Load facilities from JSON files
    async loadFacilities() {
        const regions = ['Ahafo', 'Ashanti', 'Bono', 'Bono_East', 'Central', 'Eastern', 'Greater_Accra', 'North_East', 'Northern', 'Oti', 'Savannah', 'Upper_East', 'Upper_West', 'Volta', 'Western', 'Western_North'];
        let allFacilities = [];
        for (const region of regions) {
            try {
                const response = await fetch(`facilities/${region}.json`);
                if (response.ok) {
                    const regionFacilities = await response.json();
                    allFacilities = allFacilities.concat(regionFacilities);
                } else {
                    console.warn(`Could not load facilities for ${region}`);
                }
            } catch (error) {
                console.error(`Error fetching facilities for ${region}:`, error);
            }
        }
        this.facilities = allFacilities.sort((a, b) => a.Facility.localeCompare(b.Facility));
    },

    // Load CSOs from JSON file
    async loadCSOs() {
        try {
            const response = await fetch('cso.json');
            if (response.ok) {
                this.csos = await response.json();
            } else {
                console.warn('Could not load cso.json');
            }
        } catch (error) {
            console.error('Error fetching CSOs:', error);
        }
    },

    // Data storage (in-memory, can be extended to IndexedDB)
    data: {
        roles: [
            { id: 1, name: 'Admin', isDefault: true },
            { id: 2, name: 'User', isDefault: true }
        ],
        users: [
            { id: 1, username: 'admin', password: 'admin123', roleId: 1, scope: { type: 'none', value: null } }
        ],
        forms: [],
        records: [],
    cso_data: [], // Legacy, will be replaced by loading cso.json
    reports: [] // Saved report definitions
    },

    // Load data from localStorage
    loadFromStorage() {
        const stored = localStorage.getItem('registerSystemData');
        if (stored) {
            const parsedData = JSON.parse(stored);
            // Ensure new data structures exist if loading old data
            this.data = { ...this.data, ...parsedData };
            if (!this.data.roles) this.data.roles = [{ id: 1, name: 'Admin', isDefault: true }, { id: 2, name: 'User', isDefault: true }];
            if (!this.data.reports) this.data.reports = [];
        }
    },

    // Save data to localStorage
    saveToStorage() {
        localStorage.setItem('registerSystemData', JSON.stringify(this.data));
    },

    // Authentication: Check if user is logged in
    checkAuth() {
        const user = localStorage.getItem('currentUser');
        if (user) {
            this.currentUser = JSON.parse(user);
            
            // Ensure currentUser has roleId (fix for legacy data)
            if (!this.currentUser.roleId && this.currentUser.username) {
                const fullUser = this.data.users.find(u => u.username === this.currentUser.username);
                if (fullUser) {
                    this.currentUser = fullUser;
                    localStorage.setItem('currentUser', JSON.stringify(fullUser));
                }
            }
            
            // Ensure permissions object exists (for legacy users)
            if (!this.currentUser.permissions) {
                this.currentUser.permissions = {
                    canManageRegisters: this.currentUser.roleId === 1, // Admins get all permissions
                    canManageUsers: this.currentUser.roleId === 1
                };
            }
            
            this.showScreen('registersScreen');
            this.updateUserInfo();
            this.loadDashboard();
        } else {
            this.showScreen('loginScreen');
        }
    },

    // Check if user has permission to perform an action
    hasPermission(permission) {
        if (!this.currentUser) return false;
        
        // Admin always has all permissions
        if (this.currentUser.roleId === 1) return true;
        
        // Check specific permission
        return this.currentUser.permissions?.[permission] || false;
    },

    // Login function
    login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        const user = this.data.users.find(u => 
            u.username === username && u.password === password
        );

        if (user) {
            // Check if password change is required
            if (user.mustChangePassword) {
                const newPassword = prompt(`Welcome ${user.username}!\n\nYou must change your password before continuing.\n\nEnter your new password:`);
                if (!newPassword || newPassword.length < 6) {
                    alert('Password must be at least 6 characters long.');
                    return;
                }
                
                const confirmPassword = prompt('Confirm your new password:');
                if (newPassword !== confirmPassword) {
                    alert('Passwords do not match. Please try again.');
                    return;
                }
                
                // Update password
                user.password = newPassword;
                user.mustChangePassword = false;
                this.saveToStorage();
                alert('Password changed successfully!');
            }
            
            this.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.showScreen('registersScreen');
            this.updateUserInfo();
            this.loadDashboard();
        } else {
            alert('Invalid credentials');
        }
    },

    // Logout function
    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.showScreen('loginScreen');
    },

    // Update user info in navbar
    updateUserInfo() {
        const userEl = document.getElementById('currentUser');
        const navTitleEl = document.getElementById('navTitle');
        if (this.currentUser) {
            userEl.textContent = this.currentUser.username;
            const scope = this.currentUser.scope;
            if (scope && scope.type !== 'none' && scope.value) {
                navTitleEl.textContent = scope.value;
            } else {
                navTitleEl.textContent = 'EQUIP HEALTH Ghana';
            }
        } else {
            userEl.textContent = 'Guest';
            navTitleEl.textContent = 'EQUIP HEALTH Ghana';
        }
    },

    // Screen navigation
    showScreen(screenId, event = null) {
        // Handle tab highlighting
        if (event) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
        }

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        
        // Load data when switching to specific screens
        if (screenId === 'usersAndRolesScreen') {
            if (this.hasPermission('canManageUsers')) {
                this.loadUsers();
                this.loadRoles();
            } else {
                // If somehow navigated without permission, bounce back
                alert('You do not have permission to view Users & Roles');
                this.showScreen('registersScreen');
                return;
            }
        } else if (screenId === 'registersScreen') {
            this.loadForms();
        }
    },

    // Load dashboard data
    loadDashboard() {
        this.loadForms();
        this.updateUIPermissions(); // Update UI based on permissions
        
        // Admin-only data is loaded when navigating to their respective screens
        if (this.currentUser.roleId === 1) { // Assuming roleId 1 is Admin
            this.loadUsers();
            this.loadRoles();
        }
    },

    // Update UI elements based on user permissions
    updateUIPermissions() {
        // Show/hide create register button
        const createRegisterBtn = document.getElementById('createRegisterBtn');
        if (createRegisterBtn) {
            createRegisterBtn.style.display = this.hasPermission('canManageRegisters') ? 'block' : 'none';
        }
        
        // Show/hide Users & Roles tab
        const usersRolesTab = document.getElementById('usersRolesTab');
        if (usersRolesTab) {
            usersRolesTab.style.display = this.hasPermission('canManageUsers') ? 'block' : 'none';
        }
        // Reports tab currently always visible when logged in
        const reportsTab = document.getElementById('reportsTab');
        if (reportsTab) {
            reportsTab.style.display = this.currentUser ? 'block' : 'none';
        }
        // Do not forcibly hide the screen container here; navigation logic will guard access.
    },

    // Placeholder for data sharing tab logic if needed in the future
    loadDataSharing() {
        // This tab is currently just for the button, but logic could go here.
    },

    // View state management
    viewStates: {
        forms: 'card', // 'card' or 'list'
        users: 'card'
    },

    // Toggle view between card and list
    toggleView(type, view) {
        this.viewStates[type] = view;
        
        // Update button states
        const cardBtn = document.getElementById(`${type}CardView`);
        const listBtn = document.getElementById(`${type}ListView`);
        
        cardBtn.classList.toggle('active', view === 'card');
        listBtn.classList.toggle('active', view === 'list');
        
        // Update container class
        const container = document.getElementById(`${type}List`);
        if (view === 'list') {
            container.classList.add('list-view');
            container.classList.remove('cards-container');
        } else {
            container.classList.remove('list-view');
            container.classList.add('cards-container');
        }
        
        // Reload the data with new view
        if (type === 'forms') {
            this.loadForms();
        } else if (type === 'users') {
            this.loadUsers();
        }
    },

    // Load forms list
    loadForms() { return FormsModule.loadForms(); },
    loadRecords(formId) { return FormsModule.loadRecords(formId); },

    // Load users list (admin only)
    loadUsers() {
        // Delegate to User Management module
        UserManagement.loadUsers();
    },

    // Modal management
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    // Form creation flow
    showCreateFormModal() { return FormsModule.showCreateFormModal(); },

    startFormBuilder() { return FormsModule.startFormBuilder(); },

    // Add field to form
    showAddFieldModal() { return FormsModule.showAddFieldModal(); },

    addField() { return FormsModule.addField(); },
    editField(fieldId) { return FormsModule.editField(fieldId); },
    updateField() { return FormsModule.updateField(); },

    renderFieldsList() { return FormsModule.renderFieldsList(); },

    removeField(fieldId) { return FormsModule.removeField(fieldId); },

    saveForm() { return FormsModule.saveForm(); },

    // Excel Import Functions
    showImportExcelModal() { return FormsModule.showImportExcelModal(); },

    importExcelTemplate() { return FormsModule.importExcelTemplate(); },

    // Excel file reading delegated to FormsModule

    // Excel parsing delegated to FormsModule

    // Field type mapping delegated to FormsModule

    deleteForm(formId) { return FormsModule.deleteForm(formId); },

    // Data entry flow
    openDataEntry() { return FormsModule.openDataEntry(); },

    renderDataEntryForm(form) { return FormsModule.renderDataEntryForm(form); },

    // Handle image upload and preview
    handleImageUpload(event, fieldId) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById(`preview_${fieldId}`);
            preview.innerHTML = `
                <img src="${e.target.result}" 
                    style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            `;
        };
        reader.readAsDataURL(file);
    },

    // Capture GPS location
    captureLocation(fieldId) {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        const locationDiv = document.getElementById(`location_${fieldId}`);
        locationDiv.textContent = 'Getting location...';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                
                document.getElementById(`field_${fieldId}`).value = `${lat},${lon}`;
                locationDiv.innerHTML = `
                    ✅ Location captured<br>
                    Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}<br>
                    Accuracy: ${accuracy.toFixed(0)}m
                `;
            },
            (error) => {
                locationDiv.textContent = '❌ Could not get location';
                alert('Error getting location: ' + error.message);
            }
        );
    },

    // Submit record
    submitRecord() { return FormsModule.submitRecord(); },

    // Data Sharing
    showShareModal() {
        this.showModal('shareModal');
    },

    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `equip_health_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.closeModal('shareModal');
    },

    // Encrypted backup / restore (delegates to DataPortability)
    exportEncryptedBackup() { if (typeof DataPortability !== 'undefined') return DataPortability.exportEncrypted(); },
    importEncryptedBackup() { if (typeof DataPortability !== 'undefined') return DataPortability.importEncryptedAndMerge(); },
    
    // Admin: Share user setup package
    shareUserSetup(userId) {
        if (typeof DataPortability !== 'undefined') return DataPortability.exportUserSetup(userId);
    },

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = this._handleImportFile.bind(this);
        input.click();
    },

    // Role Management - Delegated to UserManagement module
    showCreateRoleModal() {
        UserManagement.showCreateRoleModal();
    },

    createRole() {
        UserManagement.createRole();
    },

    loadRoles() {
        UserManagement.loadRoles();
    },

    deleteRole(roleId) {
        UserManagement.deleteRole(roleId);
    },

    // User Management - Delegated to UserManagement module
    showCreateUserModal() {
        UserManagement.showCreateUserModal();
    },

    createUser() {
        UserManagement.createUser();
    },

    showEditUserModal(userId) {
        UserManagement.showEditUserModal(userId);
    },

    saveUserChanges() {
        UserManagement.saveUserChanges();
    },

    deleteUser(userId) {
        UserManagement.deleteUser(userId);
    },

    populateRegisterCheckboxes(prefix, selectedRegisterIds = []) {
        UserManagement.populateRegisterCheckboxes(prefix, selectedRegisterIds);
    },

    getSelectedRegisters(prefix) {
        return UserManagement.getSelectedRegisters(prefix);
    },

    populateCSOCheckboxes(prefix, selectedDistrict, selectedCSOs = []) {
        UserManagement.populateCSOCheckboxes(prefix, selectedDistrict, selectedCSOs);
    },

    getSelectedCSOs(prefix) {
        return UserManagement.getSelectedCSOs(prefix);
    },

    populateRoleSelect(selectId, selectedId = null) {
        UserManagement.populateRoleSelect(selectId, selectedId);
    },

    initScopeSelection(prefix, scope) {
        UserManagement.initScopeSelection(prefix, scope);
    },

    handleScopeChange(prefix, level, userScope = null) {
        UserManagement.handleScopeChange(prefix, level, userScope);
    },

    getScopeFromSelection(prefix) {
        return UserManagement.getScopeFromSelection(prefix);
    },

    // (Removed duplicated in-module implementations of user & role management.
    //  All user/role operations now delegate exclusively to UserManagement in users.js)

    // New navigation and record management functions
    openRegisterRecords(formId) { return FormsModule.openRegisterRecords(formId); },

    viewRecordDetails(recordId) { return FormsModule.viewRecordDetails(recordId); },

    deleteRecord(recordId) { return FormsModule.deleteRecord(recordId); },

    updateRecord() { return FormsModule.updateRecord(); },

    exportRegisterData() { return FormsModule.exportRegisterData(); },

    importRegisterData() { return FormsModule.importRegisterData(); },

    backToRecordsList() { return FormsModule.backToRecordsList(); },

    backToRegisters() {
        this.showScreen('registersScreen');
        this.loadForms();
    },

    // Navigation helpers
    backToDashboard() {
        this.showScreen('registersScreen');
        this.loadDashboard();
    },

    // Internal helper for file import
    _handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (confirm('This will overwrite all current data. Are you sure you want to proceed?')) {
                    this.data = importedData;
                    this.saveToStorage();
                    alert('Data imported successfully! The app will now reload.');
                    window.location.reload();
                }
            } catch (err) {
                alert('Error parsing JSON file. Please ensure it is a valid data export.');
            }
        };
        reader.readAsText(file);
        this.closeModal('shareModal');
    }
};

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => {
            console.log('Service worker registered', reg);

            // Update flow: prompt user to refresh when a new version is available
            function promptSWUpdate(worker) {
                // Minimal UX: confirm dialog; replace with a toast/banner if desired
                const shouldUpdate = confirm('A new version is available. Update now?');
                if (shouldUpdate) {
                    worker.postMessage({ type: 'SKIP_WAITING' });
                }
            }

            if (reg.waiting) {
                // Already waiting to activate
                promptSWUpdate(reg.waiting);
            }

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New update available
                        promptSWUpdate(newWorker);
                    }
                });
            });

            // Reload the page after the updated SW takes control
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                refreshing = true;
                window.location.reload();
            });

            // Optional: Listen for SW activation messages
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SW_ACTIVATED') {
                    console.log('Service Worker activated version:', event.data.version);
                }
            });
        })
        .catch(err => console.log('Service worker registration failed', err));
}

// PWA Install prompt (Android + Chromium-based browsers)
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredInstallPrompt = e;
    // Minimal UX: immediately ask; you can replace with a custom Install button
    const shouldInstall = confirm('Install EQUIP Registers for offline use?');
    if (shouldInstall && deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(() => {
            deferredInstallPrompt = null;
        });
    }
});

// iOS Install hint (Safari doesn’t support beforeinstallprompt)
function isIosStandalone() {
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isStandalone = window.navigator.standalone === true;
    return { isIOS, isStandalone };
}

window.addEventListener('load', () => {
    const { isIOS, isStandalone } = isIosStandalone();
    if (isIOS && !isStandalone) {
        // Minimal hint via alert; replace with a nicer inline banner in UI if desired
        console.log('Tip: To install, tap Share and "Add to Home Screen".');
    }
});