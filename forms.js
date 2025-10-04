// Forms / Registers Management Module for EQUIP Health Ghana
// Handles form creation, listing, record management, and Excel import

const FormsModule = {
  app: null,
  formFields: [],
  currentForm: null,

  init(appInstance) {
    this.app = appInstance;
  },

  // =============================
  // LIST & VIEW TOGGLES
  // =============================
  loadForms() {
    const container = document.getElementById('formsList');
    const isListView = this.app.viewStates.forms === 'list';

    // Filter forms by user access
    let formsToDisplay = this.app.data.forms;
    if (this.app.currentUser && this.app.currentUser.assignedRegisters && this.app.currentUser.assignedRegisters.length > 0) {
      formsToDisplay = this.app.data.forms.filter(form => this.app.currentUser.assignedRegisters.includes(form.id));
    }

    if (formsToDisplay.length === 0) {
      const message = this.app.currentUser && this.app.currentUser.assignedRegisters && this.app.currentUser.assignedRegisters.length > 0
        ? 'You do not have access to any registers'
        : 'No forms created yet';
      const subMessage = this.app.currentUser && this.app.currentUser.assignedRegisters && this.app.currentUser.assignedRegisters.length > 0
        ? 'Please contact an administrator to assign registers to you'
        : 'Create or import a register to get started';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="bi bi-clipboard-data" style="font-size: 48px;"></i></div>
          <p>${message}</p>
          <p style="font-size: 14px;">${subMessage}</p>
        </div>`;
      return;
    }

    if (isListView) {
      container.innerHTML = formsToDisplay.map(form => this._renderFormListItem(form)).join('');
    } else {
      container.innerHTML = formsToDisplay.map(form => this._renderFormCard(form)).join('');
    }
  },

  _renderFormListItem(form) {
    return `
      <div class="card-item">
        <div class="card-content">
          <div class="card-title">${form.name}</div>
          <div class="card-description">${form.description || 'No description'}</div>
          <div class="card-meta">
            <i class="bi bi-grid"></i> ${form.fields.length} fields • 
            <i class="bi bi-person"></i> ${form.createdBy} • 
            <i class="bi bi-calendar"></i> ${new Date(form.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" onclick="app.openRegisterRecords(${form.id})">
            <i class="bi bi-eye"></i> View
          </button>
          ${this.app.hasPermission('canManageRegisters') ? `
          <button class="btn btn-outline btn-sm" onclick="FormsModule.startEditForm(${form.id}); event.stopPropagation();">
            <i class="bi bi-pencil"></i>
          </button>` : ''}
          ${this.app.hasPermission('canManageRegisters') ? `
            <button class="btn btn-outline btn-sm" onclick="app.deleteForm(${form.id})">
              <i class="bi bi-trash"></i>
            </button>` : ''}
        </div>
      </div>`;
  },

  _renderFormCard(form) {
    return `
      <div class="card-item" onclick="app.openRegisterRecords(${form.id})">
        <div class="card-title">${form.name}</div>
        <div class="card-description">${form.description || 'No description'}</div>
        <div class="card-meta">
          <i class="bi bi-grid"></i> ${form.fields.length} fields<br>
          <i class="bi bi-person"></i> ${form.createdBy}<br>
          <i class="bi bi-calendar"></i> ${new Date(form.createdAt).toLocaleDateString()}
        </div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-primary btn-sm" onclick="app.openRegisterRecords(${form.id})">
            <i class="bi bi-eye"></i> View Records
          </button>
          ${this.app.hasPermission('canManageRegisters') ? `
          <button class="btn btn-outline btn-sm" onclick="FormsModule.startEditForm(${form.id}); event.stopPropagation();">
            <i class="bi bi-pencil"></i>
          </button>` : ''}
          ${this.app.hasPermission('canManageRegisters') ? `
            <button class="btn btn-outline btn-sm" onclick="app.deleteForm(${form.id})">
              <i class="bi bi-trash"></i>
            </button>` : ''}
        </div>
      </div>`;
  },

  // =============================
  // CREATION FLOW
  // =============================
  showCreateFormModal() {
    this.app.showModal('createFormModal');
  },

  startFormBuilder() {
    this.formFields = [];
    this.app.showScreen('formBuilderScreen');
    document.getElementById('formName').value = '';
    document.getElementById('formDescription').value = '';
    document.getElementById('fieldsList').innerHTML = '';
  },

  showAddFieldModal() {
    document.getElementById('fieldLabel').value = '';
    document.getElementById('fieldType').value = 'text';
    document.getElementById('fieldChoices').value = '';
    document.getElementById('fieldRequired').checked = false;
    document.getElementById('choicesGroup').style.display = 'none';
    const hint = document.getElementById('fieldHint'); if (hint) hint.value='';
    const rel = document.getElementById('fieldRelevance'); if (rel) rel.value='';
    const cons = document.getElementById('fieldConstraint'); if (cons) cons.value='';
    const consMsg = document.getElementById('fieldConstraintMessage'); if (consMsg) consMsg.value='';
    const editingId = document.getElementById('editingFieldId'); if (editingId) editingId.value='';
    document.getElementById('addFieldConfirmBtn').style.display='inline-block';
    document.getElementById('updateFieldConfirmBtn').style.display='none';
    this.app.showModal('addFieldModal');
  },

  addField() {
    const label = document.getElementById('fieldLabel').value;
    const type = document.getElementById('fieldType').value;
    const choices = document.getElementById('fieldChoices').value;
    const required = document.getElementById('fieldRequired').checked;
    const hint = document.getElementById('fieldHint')?.value || '';
    const relevance = document.getElementById('fieldRelevance')?.value || '';
    const constraint = document.getElementById('fieldConstraint')?.value || '';
    const constraintMessage = document.getElementById('fieldConstraintMessage')?.value || '';
    if (!label) { alert('Please enter a field label'); return; }
    const safeName = label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    const field = { id: Date.now(), label, name: safeName, type, choices: choices ? choices.split(',').map(c => c.trim()) : [], required, relevance, constraint, constraintMessage, hint };
    this.formFields.push(field);
    this.renderFieldsList();
    this.app.closeModal('addFieldModal');
  },

  editField(fieldId) {
    const field = this.formFields.find(f => f.id === fieldId);
    if (!field) return;
    document.getElementById('fieldLabel').value = field.label;
    document.getElementById('fieldType').value = field.type;
    document.getElementById('fieldChoices').value = (field.choices||[]).join(', ');
    document.getElementById('fieldRequired').checked = !!field.required;
    const hint = document.getElementById('fieldHint'); if (hint) hint.value = field.hint || '';
    const rel = document.getElementById('fieldRelevance'); if (rel) rel.value = field.relevance || '';
    const cons = document.getElementById('fieldConstraint'); if (cons) cons.value = field.constraint || '';
    const consMsg = document.getElementById('fieldConstraintMessage'); if (consMsg) consMsg.value = field.constraintMessage || '';
    const editingId = document.getElementById('editingFieldId'); if (editingId) editingId.value = field.id;
    document.getElementById('addFieldConfirmBtn').style.display='none';
    document.getElementById('updateFieldConfirmBtn').style.display='inline-block';
    this.app.showModal('addFieldModal');
  },

  updateField() {
    const editingId = parseInt(document.getElementById('editingFieldId').value,10);
    if (!editingId) { alert('No field selected to update'); return; }
    const idx = this.formFields.findIndex(f => f.id === editingId);
    if (idx === -1) return;
    const label = document.getElementById('fieldLabel').value;
    const type = document.getElementById('fieldType').value;
    const choices = document.getElementById('fieldChoices').value;
    const required = document.getElementById('fieldRequired').checked;
    const hint = document.getElementById('fieldHint')?.value || '';
    const relevance = document.getElementById('fieldRelevance')?.value || '';
    const constraint = document.getElementById('fieldConstraint')?.value || '';
    const constraintMessage = document.getElementById('fieldConstraintMessage')?.value || '';
    if (!label) { alert('Please enter a field label'); return; }
    const safeName = label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    this.formFields[idx] = { ...this.formFields[idx], label, name: safeName, type, choices: choices ? choices.split(',').map(c => c.trim()) : [], required, hint, relevance, constraint, constraintMessage };
    this.renderFieldsList();
    this.app.closeModal('addFieldModal');
  },

  renderFieldsList() {
    const container = document.getElementById('fieldsList');
    container.innerHTML = this.formFields.map(field => `
      <div class="list-item">
        <div>
          <strong>${field.label}</strong>
          <div style="font-size: 12px; color: #6B7280;">${field.type} ${field.required ? '(Required)' : ''}</div>
          ${field.relevance ? `<div style='font-size:11px;color:#0157ae;'>Skip: ${field.relevance}</div>`:''}
          ${field.constraint ? `<div style='font-size:11px;color:#d42729;'>Constraint: ${field.constraint}</div>`:''}
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-outline" onclick="app.editField(${field.id})" style="width:auto; padding:6px 12px;">Edit</button>
          <button class="btn btn-outline" onclick="app.removeField(${field.id})" style="width:auto; padding:6px 12px;">Remove</button>
        </div>
      </div>`).join('');
  },

  removeField(fieldId) {
    this.formFields = this.formFields.filter(f => f.id !== fieldId);
    this.renderFieldsList();
  },

  saveForm() {
    const name = document.getElementById('formName').value;
    const description = document.getElementById('formDescription').value;
    if (!name || this.formFields.length === 0) { alert('Please enter form name and add at least one field'); return; }
    // If editing existing form
    if (this.currentForm && this._editingForm) {
      const idx = this.app.data.forms.findIndex(f => f.id === this.currentForm.id);
      if (idx !== -1) {
        this.app.data.forms[idx] = { ...this.app.data.forms[idx], name, description, fields: [...this.formFields], updatedAt: new Date().toISOString() };
        this.app.saveToStorage();
        alert('Form updated successfully!');
        this._editingForm = false;
        this.app.backToDashboard();
        return;
      }
    }
    const form = { id: Date.now(), name, description, fields: [...this.formFields], createdBy: this.app.currentUser.username, createdAt: new Date().toISOString() };
    this.app.data.forms.push(form);
    this.app.saveToStorage();
    alert('Form created successfully!');
    this.app.backToDashboard();
  },

  startEditForm(formId) {
    const form = this.app.data.forms.find(f => f.id === formId);
    if (!form) { alert('Form not found'); return; }
    if (!this.app.hasPermission('canManageRegisters')) { alert('No permission to edit registers.'); return; }
    this.currentForm = form;
    this._editingForm = true;
    this.formFields = JSON.parse(JSON.stringify(form.fields));
    this.app.showScreen('formBuilderScreen');
    document.getElementById('formName').value = form.name;
    document.getElementById('formDescription').value = form.description || '';
    this.renderFieldsList();
  },

  deleteForm(formId) {
    if (!this.app.hasPermission('canManageRegisters')) { alert('No permission to delete registers.'); return; }
    if (confirm('Are you sure you want to delete this form?')) {
      this.app.data.forms = this.app.data.forms.filter(f => f.id !== formId);
      this.app.data.records = this.app.data.records.filter(r => r.formId !== formId);
      this.app.saveToStorage();
      this.loadForms();
    }
  },

  // =============================
  // EXCEL IMPORT
  // =============================
  showImportExcelModal() {
    this.app.closeModal('createFormModal');
    this.app.showModal('importExcelModal');
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) fileInput.value = '';
  },

  async importExcelTemplate() {
    const fileInput = document.getElementById('excelFileInput');
    const file = fileInput.files[0];
    if (!file) { alert('Please select an Excel file'); return; }
    try {
      const data = await this.readExcelFile(file);
      const form = this.parseExcelToForm(data);
      if (form) {
        this.app.data.forms.push(form);
        this.app.saveToStorage();
        this.app.closeModal('importExcelModal');
        alert(`Register "${form.name}" created with ${form.fields.length} fields!`);
        this.app.backToDashboard();
      }
    } catch (e) {
      console.error('Error importing Excel:', e);
      alert('Error importing Excel file: ' + e.message);
    }
  },

  readExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          resolve(workbook);
        } catch (err) { reject(err); }
      };
      reader.onerror = err => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  parseExcelToForm(workbook) {
    if (!workbook.Sheets['Metadata']) throw new Error('Missing "Metadata" sheet');
    if (!workbook.Sheets['Fields']) throw new Error('Missing "Fields" sheet');
    const metadataSheet = workbook.Sheets['Metadata'];
    const metadataData = XLSX.utils.sheet_to_json(metadataSheet, { header: 1 });
    const metadata = {};
    metadataData.forEach(row => { if (row[0] && row[1]) metadata[row[0]] = row[1]; });
    const fieldsSheet = workbook.Sheets['Fields'];
    const fieldsData = XLSX.utils.sheet_to_json(fieldsSheet);
    const fields = fieldsData.map((row, index) => {
      const fieldType = this.mapExcelFieldType(row['Type']);
      const field = {
        id: Date.now() + index,
        label: row['Field Label'] || '',
        name: row['Field Name'] || '',
        type: fieldType,
        required: row['Required'] === 'Yes' || row['Required'] === true,
        validation: row['Validation'] || '',
        hint: row['Hint/Description'] || '',
        relevance: row['Relevance'] || row['Skip Logic'] || '',
        constraint: row['Constraint'] || '',
        constraintMessage: row['Constraint Message'] || ''
      };
      if (row['Options'] && (fieldType === 'select_one' || fieldType === 'select_multiple')) {
        field.choices = row['Options'].split(';').map(c => c.trim()).filter(c => c);
      } else { field.choices = []; }
      return field;
    });
    return {
      id: Date.now(),
      name: metadata['Register Name'] || 'Imported Register',
      description: metadata['Description'] || '',
      version: metadata['Version'] || '1.0',
      targetPopulation: metadata['Target Population'] || '',
      module: metadata['Module'] || '',
      fields,
      createdBy: this.app.currentUser.username,
      createdAt: metadata['Date Created'] || new Date().toISOString(),
      importedFrom: 'Excel'
    };
  },

  mapExcelFieldType(excelType) {
    const typeMap = { Text: 'text', Number: 'number', Date: 'date', Select: 'select_one', YesNo: 'yesno', LongText: 'textarea' };
    return typeMap[excelType] || 'text';
  },

  // =============================
  // RECORDS
  // =============================
  openRegisterRecords(formId) {
    this.loadRecords(formId);
    this.app.showScreen('recordsListScreen');
  },

  loadRecords(formId) {
    const form = this.app.data.forms.find(f => f.id === formId);
    if (!form) return;
    this.currentForm = form;
    document.getElementById('recordsListTitle').textContent = `${form.name} Records`;
    const tableHead = document.querySelector('#recordsTable thead');
    const tableBody = document.querySelector('#recordsTable tbody');
    const emptyState = document.getElementById('recordsEmptyState');
    const tableContainer = document.getElementById('recordsTableContainer');
    const recordsForForm = this.app.data.records.filter(r => r.formId === formId);

    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    if (recordsForForm.length === 0) {
      emptyState.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p>No records submitted for this register yet.</p>
        </div>`;
      emptyState.style.display = 'block';
      tableContainer.style.display = 'none';
      return;
    } else {
      emptyState.style.display = 'none';
      tableContainer.style.display = 'block';
    }
    const headerRow = document.createElement('tr');
    form.fields.forEach(field => { if (field.type !== 'note') headerRow.innerHTML += `<th>${field.label}</th>`; });
    headerRow.innerHTML += '<th>Actions</th>';
    tableHead.appendChild(headerRow);

    recordsForForm.forEach(record => {
      const recordRow = document.createElement('tr');
      form.fields.forEach(field => {
        if (field.type !== 'note') {
          const value = record.data[field.label] || '';
            recordRow.innerHTML += `<td data-label="${field.label}">${Array.isArray(value) ? value.join(', ') : value}</td>`;
        }
      });
      recordRow.innerHTML += `
        <td>
          <div class="action-row" style="margin-top:0; gap:8px;">
            <button class="btn btn-outline" style="width:auto; padding:6px 12px;" onclick="app.viewRecordDetails(${record.id})">Edit</button>
            <button class="btn btn-outline" style="width:auto; padding:6px 12px;" onclick="app.deleteRecord(${record.id})">Delete</button>
          </div>
        </td>`;
      tableBody.appendChild(recordRow);
    });
  },

  openDataEntry() {
    if (!this.currentForm) return;
    this.app.showScreen('dataEntryScreen');
    document.getElementById('entryFormTitle').textContent = `New Entry for ${this.currentForm.name}`;
    this.renderDataEntryForm(this.currentForm);
  },

  renderDataEntryForm(form) {
    const container = document.getElementById('dataEntryForm');
    container.innerHTML = form.fields.map(field => this._renderFieldInput(field)).join('');
    // After initial render apply relevance and attach listeners
    form.fields.forEach(field => {
      if (field.type === 'note') return;
      const el = document.getElementById(`field_${field.id}`);
      if (el) {
        el.addEventListener('change', () => this.recomputeRelevance());
        el.addEventListener('input', () => this.recomputeRelevance());
      }
    });
    this.recomputeRelevance();
  },

  _renderFieldInput(field) {
    let input = '';
    switch(field.type) {
      case 'text': input = `<input type="text" class="form-input" id="field_${field.id}" ${field.required?'required':''}>`; break;
      case 'number':
      case 'integer': input = `<input type="number" step="1" class="form-input" id="field_${field.id}" ${field.required?'required':''}>`; break;
      case 'decimal': input = `<input type="number" step="0.01" class="form-input" id="field_${field.id}" ${field.required?'required':''}>`; break;
      case 'date': input = `<input type="date" class="form-input" id="field_${field.id}" ${field.required?'required':''}>`; break;
      case 'time': input = `<input type="time" class="form-input" id="field_${field.id}" ${field.required?'required':''}>`; break;
      case 'datetime': input = `<input type="datetime-local" class="form-input" id="field_${field.id}" ${field.required?'required':''}>`; break;
      case 'textarea': input = `<textarea class="form-input" id="field_${field.id}" rows="4" ${field.required?'required':''}></textarea>`; break;
      case 'yes_no':
        input = `<select class="form-input" id="field_${field.id}" ${field.required?'required':''}><option value="">-- Select --</option><option value="Yes">Yes</option><option value="No">No</option></select>`; break;
      case 'select_one':
        input = `<select class="form-input" id="field_${field.id}" ${field.required?'required':''}><option value="">-- Select --</option>${(field.choices||[]).map(c=>`<option value="${c}">${c}</option>`).join('')}</select>`; break;
      case 'select_multiple':
        input = `<div style="background: rgba(255,255,255,0.9); padding:12px; border-radius:12px;">${(field.choices||[]).map(c=>`<label style="display:block; margin-bottom:8px;"><input type="checkbox" name="field_${field.id}" value="${c}"> ${c}</label>`).join('')}</div>`; break;
      case 'cso':
        let userDistrict = null;
        if (this.app.currentUser.scope && this.app.currentUser.scope.type === 'facility') {
          const facility = this.app.facilities.find(f => f.Facility === this.app.currentUser.scope.value);
          if (facility) userDistrict = facility.District;
        } else if (this.app.currentUser.scope && this.app.currentUser.scope.type === 'district') {
          userDistrict = this.app.currentUser.scope.value;
        }
        const csoOptions = userDistrict ? this.app.csos.filter(c => c.district === userDistrict) : this.app.csos;
        input = `<select class="form-input" id="field_${field.id}" ${field.required?'required':''}><option value="">-- Select CSO --</option>${[...new Set(csoOptions.map(c=>c.cso))].sort().map(c=>`<option value='${c}'>${c}</option>`).join('')}</select>`; break;
      case 'geopoint':
        input = `<button type="button" class="btn btn-secondary" onclick="app.captureLocation(${field.id})">Get Current Location</button><input type="hidden" id="field_${field.id}"><div id="location_${field.id}" style="margin-top:8px; font-size:14px; color:#6B7280;"></div>`; break;
      case 'image':
        input = `<input type="file" accept="image/*" class="form-input" id="field_${field.id}" onchange="app.handleImageUpload(event, ${field.id})"><div id="preview_${field.id}" style="margin-top:12px;"></div>`; break;
      case 'barcode': input = `<input type="text" class="form-input" id="field_${field.id}" placeholder="Scan or enter barcode" ${field.required?'required':''}>`; break;
      case 'facility_referral':
        const facilityOptions = this.app.facilities.map(f=>f.Facility).filter(Boolean).sort();
        input = `<select class="form-input" id="field_${field.id}" ${field.required?'required':''}><option value="">-- Select Facility --</option>${[...new Set(facilityOptions)].map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`; break;
      case 'cso_referral':
        const csos = this.app.csos.map(c=>c.cso).filter(Boolean).sort();
        input = `<select class="form-input" id="field_${field.id}" ${field.required?'required':''}><option value="">-- Select CSO --</option>${[...new Set(csos)].map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`; break;
      case 'note': return `<div class="form-group"><div style="padding:12px; background: rgba(1,87,174,0.1); border-radius:8px; font-size:14px;"><i class="bi bi-info-circle"></i> ${field.label}</div></div>`;
      case 'calculate': input = `<input type="text" class="form-input" id="field_${field.id}" readonly>`; break;
      default: input = `<input type="text" class="form-input" id="field_${field.id}" ${field.required?'required':''}>`;
    }
    const relevanceAttr = field.relevance ? ` data-relevance="${field.relevance.replace(/"/g,'&quot;')}"` : '';
    const constraintAttr = field.constraint ? ` data-constraint="${field.constraint.replace(/"/g,'&quot;')}" data-constraint-message="${(field.constraintMessage||'').replace(/"/g,'&quot;')}"` : '';
    return `<div class='form-group' id='group_${field.id}' data-field-label='${field.label.replace(/'/g,"&#39;")}' data-field-name='${(field.name||'').replace(/'/g,"&#39;")}'${relevanceAttr}${constraintAttr}><label class='form-label'>${field.label} ${field.required?'<span style="color: var(--color-primary);">*</span>':''}</label>${field.hint?`<div style='font-size:12px; color:#6B7280; margin-bottom:4px;'>${field.hint}</div>`:''}${input}<div class='constraint-error' id='err_${field.id}' style='display:none; color:#d42729; font-size:12px; margin-top:4px;'></div></div>`;
  },

  // Evaluate and apply relevance (skip logic)
  recomputeRelevance() {
    if (!this.currentForm) return;
    const values = this.collectCurrentValues();
    this.currentForm.fields.forEach(field => {
      if (!field.relevance) return; // always visible if no relevance
      const group = document.getElementById(`group_${field.id}`);
      if (!group) return;
      const result = this.evaluateExpression(field.relevance, values);
      group.style.display = result ? '' : 'none';
    });
  },

  collectCurrentValues() {
    const valMap = {};
    (this.currentForm?.fields || []).forEach(f => {
      if (f.type === 'note') return;
      let v = '';
      if (f.type === 'select_multiple') {
        const boxes = document.querySelectorAll(`input[name="field_${f.id}"]:checked`);
        v = Array.from(boxes).map(b=>b.value);
      } else {
        const el = document.getElementById(`field_${f.id}`);
        if (el) v = el.value;
      }
      valMap[f.label] = v;
      if (f.name) valMap[f.name] = v;
    });
    return valMap;
  },

  // Simple safe evaluator for relevance / constraint expressions
  evaluateExpression(expr, values) {
    if (!expr) return true;
    let safe = expr;
    // Replace ${Field Label} tokens
    safe = safe.replace(/\$\{([^}]+)\}/g, (m, p1) => {
      const key = p1.trim();
      const val = values[key];
      return JSON.stringify(val);
    });
    // Convert single '=' to '==' (avoid affecting '>=', '<=', '!=')
    safe = safe.replace(/(^|[^!<>=])=([^=])/g, '$1==$2');
    // Allow only safe chars
    if (!/^[0-9A-Za-z_"'\s\[\],.:;\-<>=!&|()+]*$/.test(safe)) return false;
    try {
      // eslint-disable-next-line no-new-func
      return !!Function(`return (${safe})`)();
    } catch(e) {
      console.warn('Expression eval error', expr, safe, e);
      return false;
    }
  },

  submitRecord() {
    const formData = {};
    let isValid = true;
    const values = this.collectCurrentValues();
    this.currentForm.fields.forEach(field => {
      if (field.type === 'note') return;
      // Skip hidden by relevance
      const group = document.getElementById(`group_${field.id}`);
      if (field.relevance && group && group.style.display === 'none') {
        formData[field.label] = ''; // not captured
        return;
      }
      let value;
      if (field.type === 'select_multiple') {
        const checkboxes = document.querySelectorAll(`input[name="field_${field.id}"]:checked`);
        value = Array.from(checkboxes).map(cb => cb.value);
      } else if (field.type === 'image') {
        const fileInput = document.getElementById(`field_${field.id}`);
        value = fileInput.files[0] ? fileInput.files[0].name : '';
      } else {
        const input = document.getElementById(`field_${field.id}`);
        value = input ? input.value : '';
      }
      if (field.required && (!value || value.length === 0)) {
        isValid = false;
        alert(`Please fill in required field: ${field.label}`);
      }
      // Constraint validation
      if (isValid && field.constraint) {
        const constraintOk = this.evaluateExpression(field.constraint, { ...values, [field.label]: value, [field.name||field.label]: value });
        const errEl = document.getElementById(`err_${field.id}`);
        if (!constraintOk) {
          isValid = false;
          if (errEl) {
            errEl.textContent = field.constraintMessage || 'Invalid value';
            errEl.style.display = 'block';
          }
        } else if (errEl) { errEl.style.display = 'none'; }
      }
      formData[field.label] = value;
    });
    if (!isValid) return;
    const record = { id: Date.now(), formId: this.currentForm.id, data: formData, submittedBy: this.app.currentUser.username, submittedAt: new Date().toISOString() };
    this.app.data.records.push(record);
    this.app.saveToStorage();
    alert('Record submitted successfully!');
    this.backToRecordsList();
  },

  viewRecordDetails(recordId) {
    this.app.editingRecordId = recordId;
    const record = this.app.data.records.find(r => r.id === recordId);
    const form = this.app.data.forms.find(f => f.id === record.formId);
    if (!record || !form) return;
    const container = document.getElementById('recordDetailForm');
    container.innerHTML = form.fields.map(field => {
      const value = record.data[field.label] || '';
      let input = '';
      switch(field.type) {
        case 'text':
        case 'integer':
        case 'decimal':
        case 'barcode':
          input = `<input type='text' class='form-input' id='edit_field_${field.id}' value='${value}'>`; break;
        case 'date': input = `<input type='date' class='form-input' id='edit_field_${field.id}' value='${value}'>`; break;
        case 'select_one':
        case 'yes_no':
        case 'cso':
          const opts = (field.choices||[]).map(c => `<option value='${c}' ${c===value?'selected':''}>${c}</option>`).join('');
          input = `<select class='form-input' id='edit_field_${field.id}'><option value=''>-- Select --</option>${opts}</select>`; break;
        default: input = `<div>${value}</div>`;
      }
      return `<div class='form-group'><label class='form-label'>${field.label}</label>${input}</div>`;
    }).join('');
    this.app.showScreen('recordDetailScreen');
  },

  updateRecord() {
    if (this.app.editingRecordId === null) return;
    const recordIndex = this.app.data.records.findIndex(r => r.id === this.app.editingRecordId);
    if (recordIndex === -1) return;
    const record = this.app.data.records[recordIndex];
    const form = this.app.data.forms.find(f => f.id === record.formId);
    const updatedData = {};
    form.fields.forEach(field => {
      const input = document.getElementById(`edit_field_${field.id}`);
      if (input) updatedData[field.label] = input.value;
    });
    this.app.data.records[recordIndex].data = updatedData;
    this.app.saveToStorage();
    alert('Record updated successfully!');
    this.backToRecordsList();
  },

  deleteRecord(recordId) {
    if (confirm('Are you sure you want to delete this record?')) {
      this.app.data.records = this.app.data.records.filter(r => r.id !== recordId);
      this.app.saveToStorage();
      this.backToRecordsList();
    }
  },

  exportRegisterData() {
    if (!this.currentForm) return;
    const recordsToExport = this.app.data.records.filter(r => r.formId === this.currentForm.id);
    const dataStr = JSON.stringify(recordsToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentForm.name}_records_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importRegisterData() {
    alert('Import per register is a planned feature!');
  },

  backToRecordsList() {
    if (!this.currentForm) { this.app.backToDashboard(); return; }
    this.openRegisterRecords(this.currentForm.id);
  },
  
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormsModule;
}
