// EQUIP Analytics & Reporting Module
// DHIS2-inspired data visualizer with indicator builder, disaggregation, and sharing
// Version: 2.0 - Complete redesign for better UX and functionality

const AnalyticsModule = {
	app: null,
	currentIndicator: null,
	indicators: [], // Saved indicator definitions
	currentVisualization: null,
	chart: null, // Chart.js instance
	
	init(appInstance) {
		this.app = appInstance;
		this.loadIndicators();
		this.initializeUI();
	},

	initializeUI() {
		// Set up analytics home view
		this.showView('home');
		this.renderIndicatorLibrary();
	},

	showView(viewName) {
		const views = ['home', 'builder', 'results'];
		views.forEach(v => {
			const el = document.getElementById(`analytics${v.charAt(0).toUpperCase() + v.slice(1)}View`);
			if (el) el.style.display = (v === viewName) ? 'block' : 'none';
		});
	},

	// =============================
	// INDICATOR BUILDER
	// =============================
	
	startNewIndicator() {
		this.currentIndicator = {
			id: Date.now(),
			name: '',
			description: '',
			register: null,
			dataElements: [], // {id, name, formula, type: 'count'|'sum'|'custom'}
			disaggregations: [], // {field, groups: [{name, condition}]}
			filters: {
				dateField: null,
				startDate: null,
				endDate: null,
				location: {
					region: null,
					zone: null,
					district: null,
					facility: null
				}
			},
			visualization: {
				type: 'table', // 'table'|'bar'|'line'|'pie'
				showTotal: true,
				colorScheme: 'colorblind' // accessible colors
			},
			createdBy: this.app.currentUser?.username,
			createdAt: new Date().toISOString(),
			shared: false
		};
		
		this.showView('builder');
		this.renderBuilder();
	},

	renderBuilder() {
		const container = document.getElementById('indicatorBuilderContainer');
		if (!container) return;

		container.innerHTML = `
			<div class="analytics-builder">
				<!-- Step 1: Basic Info -->
				<div class="builder-section">
					<h3><i class="bi bi-info-circle"></i> Indicator Information</h3>
					<div class="form-group">
						<label class="form-label">Indicator Name</label>
						<input type="text" id="indicatorName" class="form-input" 
							placeholder="e.g., PrEP_New: Pregnant Women" 
							value="${this.currentIndicator.name || ''}">
					</div>
					<div class="form-group">
						<label class="form-label">Description</label>
						<textarea id="indicatorDescription" class="form-input" rows="2" 
							placeholder="e.g., Number of pregnant women newly enrolled on PrEP">${this.currentIndicator.description || ''}</textarea>
					</div>
					<div class="form-group">
						<label class="form-label">Data Source (Register)</label>
						<select id="indicatorRegister" class="form-input" onchange="AnalyticsModule.onRegisterSelected()">
							<option value="">-- Select Register --</option>
							${this.app.data.forms.map(f => `
								<option value="${f.id}" ${this.currentIndicator.register?.id === f.id ? 'selected' : ''}>
									${f.name}
								</option>
							`).join('')}
						</select>
					</div>
				</div>

				<!-- Step 2: Data Elements -->
				<div class="builder-section">
					<h3><i class="bi bi-calculator"></i> Data Elements</h3>
					<p class="help-text">Define what you want to measure. Drag fields from the palette to build formulas.</p>
					
					<div id="fieldPalette" class="field-palette"></div>
					
					<div class="data-elements-list" id="dataElementsList">
						<div class="empty-state" style="text-align:center; padding:40px; color:#6B7280;">
							<i class="bi bi-inbox" style="font-size:48px;"></i>
							<p>No data elements yet. Click "Add Data Element" to get started.</p>
						</div>
					</div>
					
					<button class="btn btn-secondary" onclick="AnalyticsModule.addDataElement()">
						<i class="bi bi-plus-circle"></i> Add Data Element
					</button>
				</div>

				<!-- Step 3: Disaggregation -->
				<div class="builder-section">
					<h3><i class="bi bi-funnel"></i> Disaggregation</h3>
					<p class="help-text">Break down results by categories (e.g., Sex, Age, Pregnancy Status)</p>
					
					<div id="disaggregationsList"></div>
					
					<button class="btn btn-secondary" onclick="AnalyticsModule.addDisaggregation()">
						<i class="bi bi-plus-circle"></i> Add Disaggregation
					</button>
				</div>

				<!-- Step 4: Filters -->
				<div class="builder-section">
					<h3><i class="bi bi-filter"></i> Filters</h3>
					<div class="form-row">
						<div class="form-group">
							<label class="form-label">Date Field</label>
							<select id="filterDateField" class="form-input">
								<option value="">-- Select Date Field --</option>
							</select>
						</div>
						<div class="form-group">
							<label class="form-label">Start Date</label>
							<input type="date" id="filterStartDate" class="form-input">
						</div>
						<div class="form-group">
							<label class="form-label">End Date</label>
							<input type="date" id="filterEndDate" class="form-input">
						</div>
					</div>
				</div>

				<!-- Step 5: Visualization -->
				<div class="builder-section">
					<h3><i class="bi bi-bar-chart"></i> Visualization</h3>
					<div class="form-row">
						<div class="form-group">
							<label class="form-label">Chart Type</label>
							<select id="vizType" class="form-input">
								<option value="table">Table</option>
								<option value="bar">Bar Chart</option>
								<option value="line">Line Chart</option>
								<option value="pie">Pie Chart</option>
							</select>
						</div>
						<div class="form-group">
							<label class="form-label">
								<input type="checkbox" id="vizShowTotal" checked> Show Totals
							</label>
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="builder-actions">
					<button class="btn btn-outline" onclick="AnalyticsModule.goHome()">
						<i class="bi bi-x-circle"></i> Cancel
					</button>
					<button class="btn btn-secondary" onclick="AnalyticsModule.saveIndicator()">
						<i class="bi bi-save"></i> Save Indicator
					</button>
					<button class="btn btn-primary" onclick="AnalyticsModule.runIndicator()">
						<i class="bi bi-play-circle"></i> Run Analysis
					</button>
				</div>
			</div>
		`;

		this.renderFieldPalette();
		this.renderDataElements();
		this.renderDisaggregations();
	},

	onRegisterSelected() {
		const regId = parseInt(document.getElementById('indicatorRegister')?.value, 10);
		const form = this.app.data.forms.find(f => f.id === regId);
		
		if (form) {
			this.currentIndicator.register = form;
			this.renderFieldPalette();
			this.populateDateFieldDropdown();
		}
	},

	renderFieldPalette() {
		const palette = document.getElementById('fieldPalette');
		if (!palette || !this.currentIndicator.register) return;

		const fields = this.currentIndicator.register.fields || [];
		
		palette.innerHTML = `
			<div class="palette-header">Available Fields</div>
			<div class="palette-chips">
				${fields.map(f => `
					<div class="field-chip" 
						draggable="true" 
						data-field="${f.label}"
						ondragstart="AnalyticsModule.onFieldDragStart(event, '${f.label.replace(/'/g, "\\'")}')"
						onclick="AnalyticsModule.insertField('${f.label.replace(/'/g, "\\'")}')">
						<i class="bi bi-tag"></i> ${f.label}
						<span class="field-type">${f.type}</span>
					</div>
				`).join('')}
			</div>
		`;
	},

	onFieldDragStart(event, fieldLabel) {
		event.dataTransfer.setData('text/plain', `{${fieldLabel}}`);
	},

	insertField(fieldLabel) {
		const activeInput = document.activeElement;
		if (activeInput && activeInput.tagName === 'TEXTAREA') {
			const start = activeInput.selectionStart;
			const end = activeInput.selectionEnd;
			const text = activeInput.value;
			const token = `{${fieldLabel}}`;
			activeInput.value = text.substring(0, start) + token + text.substring(end);
			activeInput.selectionStart = activeInput.selectionEnd = start + token.length;
			activeInput.focus();
		}
	},

	// =============================
	// DATA ELEMENTS
	// =============================

	addDataElement() {
		const element = {
			id: Date.now(),
			name: '',
			formula: '',
			type: 'count'
		};
		
		this.currentIndicator.dataElements.push(element);
		this.renderDataElements();
	},

	renderDataElements() {
		const container = document.getElementById('dataElementsList');
		if (!container) return;

		if (this.currentIndicator.dataElements.length === 0) {
			container.innerHTML = `
				<div class="empty-state" style="text-align:center; padding:40px; color:#6B7280;">
					<i class="bi bi-inbox" style="font-size:48px;"></i>
					<p>No data elements yet. Click "Add Data Element" to get started.</p>
				</div>
			`;
			return;
		}

		container.innerHTML = this.currentIndicator.dataElements.map((el, idx) => `
			<div class="data-element-card">
				<div class="form-group">
					<label class="form-label">Element Name</label>
					<input type="text" class="form-input" 
						value="${el.name || ''}" 
						onchange="AnalyticsModule.updateDataElement(${idx}, 'name', this.value)"
						placeholder="e.g., Pregnant Women">
				</div>
				
				<div class="form-group">
					<label class="form-label">Type</label>
					<select class="form-input" 
						onchange="AnalyticsModule.updateDataElement(${idx}, 'type', this.value)">
						<option value="count" ${el.type === 'count' ? 'selected' : ''}>Count (count_if)</option>
						<option value="sum" ${el.type === 'sum' ? 'selected' : ''}>Sum (sum_if)</option>
						<option value="custom" ${el.type === 'custom' ? 'selected' : ''}>Custom Formula</option>
					</select>
				</div>

				<div class="form-group">
					<label class="form-label">Formula / Condition</label>
					<textarea class="form-input formula-input" rows="2"
						onchange="AnalyticsModule.updateDataElement(${idx}, 'formula', this.value)"
						ondrop="AnalyticsModule.onFormulaDrop(event, ${idx})"
						ondragover="event.preventDefault()"
						placeholder="${this.getFormulaPlaceholder(el.type)}">${el.formula || ''}</textarea>
					<small class="help-text">Drag fields from above or type. Use {Field Name} for tokens.</small>
				</div>

				<button class="btn btn-outline btn-sm" onclick="AnalyticsModule.removeDataElement(${idx})">
					<i class="bi bi-trash"></i> Remove
				</button>
			</div>
		`).join('');
	},

	getFormulaPlaceholder(type) {
		switch(type) {
			case 'count': return '{Pregnancy Status} == "Pregnant"';
			case 'sum': return '{Number of Clients}';
			case 'custom': return 'count_if({Status} == "New") + sum_if({Doses}, {Status} == "Continuing")';
			default: return '';
		}
	},

	onFormulaDrop(event, idx) {
		event.preventDefault();
		const data = event.dataTransfer.getData('text/plain');
		const textarea = event.target;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		textarea.value = text.substring(0, start) + data + text.substring(end);
		this.updateDataElement(idx, 'formula', textarea.value);
	},

	updateDataElement(idx, field, value) {
		if (this.currentIndicator.dataElements[idx]) {
			this.currentIndicator.dataElements[idx][field] = value;
		}
	},

	removeDataElement(idx) {
		this.currentIndicator.dataElements.splice(idx, 1);
		this.renderDataElements();
	},

	// =============================
	// DISAGGREGATION
	// =============================

	addDisaggregation() {
		const disagg = {
			id: Date.now(),
			field: '',
			groups: []
		};
		
		this.currentIndicator.disaggregations.push(disagg);
		this.renderDisaggregations();
	},

	renderDisaggregations() {
		const container = document.getElementById('disaggregationsList');
		if (!container) return;

		if (this.currentIndicator.disaggregations.length === 0) {
			container.innerHTML = `
				<div class="empty-state" style="text-align:center; padding:20px; color:#6B7280;">
					<p>No disaggregations. Add one to break down your data.</p>
				</div>
			`;
			return;
		}

		const fields = this.currentIndicator.register?.fields || [];

		container.innerHTML = this.currentIndicator.disaggregations.map((disagg, idx) => `
			<div class="disaggregation-card">
				<div class="form-group">
					<label class="form-label">Disaggregate By Field</label>
					<select class="form-input" 
						onchange="AnalyticsModule.updateDisaggregation(${idx}, 'field', this.value)">
						<option value="">-- Select Field --</option>
						${fields.map(f => `
							<option value="${f.label}" ${disagg.field === f.label ? 'selected' : ''}>
								${f.label}
							</option>
						`).join('')}
					</select>
				</div>

				${disagg.field ? `
					<div class="form-group">
						<label class="form-label">Groups</label>
						<div id="disaggGroups${idx}" class="disagg-groups">
							${this.renderDisaggregationGroups(disagg, idx)}
						</div>
						<button class="btn btn-outline btn-sm" onclick="AnalyticsModule.addDisaggGroup(${idx})">
							<i class="bi bi-plus"></i> Add Group
						</button>
					</div>
				` : ''}

				<button class="btn btn-outline btn-sm" onclick="AnalyticsModule.removeDisaggregation(${idx})">
					<i class="bi bi-trash"></i> Remove Disaggregation
				</button>
			</div>
		`).join('');
	},

	renderDisaggregationGroups(disagg, disaggIdx) {
		if (!disagg.groups || disagg.groups.length === 0) {
			return '<p class="help-text">No groups defined yet.</p>';
		}

		return disagg.groups.map((grp, grpIdx) => `
			<div class="disagg-group-item">
				<input type="text" class="form-input" placeholder="Group name (e.g., 15-24)" 
					value="${grp.name || ''}"
					onchange="AnalyticsModule.updateDisaggGroup(${disaggIdx}, ${grpIdx}, 'name', this.value)">
				<input type="text" class="form-input" placeholder="Condition (e.g., {Age} >= 15 && {Age} <= 24)" 
					value="${grp.condition || ''}"
					onchange="AnalyticsModule.updateDisaggGroup(${disaggIdx}, ${grpIdx}, 'condition', this.value)">
				<button class="btn btn-outline btn-sm" onclick="AnalyticsModule.removeDisaggGroup(${disaggIdx}, ${grpIdx})">
					<i class="bi bi-x"></i>
				</button>
			</div>
		`).join('');
	},

	addDisaggGroup(disaggIdx) {
		const group = { name: '', condition: '' };
		this.currentIndicator.disaggregations[disaggIdx].groups.push(group);
		this.renderDisaggregations();
	},

	updateDisaggregation(idx, field, value) {
		if (this.currentIndicator.disaggregations[idx]) {
			this.currentIndicator.disaggregations[idx][field] = value;
			if (field === 'field') {
				// Reset groups when field changes
				this.currentIndicator.disaggregations[idx].groups = [];
			}
			this.renderDisaggregations();
		}
	},

	updateDisaggGroup(disaggIdx, grpIdx, field, value) {
		if (this.currentIndicator.disaggregations[disaggIdx]?.groups[grpIdx]) {
			this.currentIndicator.disaggregations[disaggIdx].groups[grpIdx][field] = value;
		}
	},

	removeDisaggregation(idx) {
		this.currentIndicator.disaggregations.splice(idx, 1);
		this.renderDisaggregations();
	},

	removeDisaggGroup(disaggIdx, grpIdx) {
		this.currentIndicator.disaggregations[disaggIdx].groups.splice(grpIdx, 1);
		this.renderDisaggregations();
	},

	// =============================
	// INDICATOR MANAGEMENT
	// =============================

	saveIndicator() {
		// Collect values from form
		this.currentIndicator.name = document.getElementById('indicatorName')?.value || '';
		this.currentIndicator.description = document.getElementById('indicatorDescription')?.value || '';
		
		if (!this.currentIndicator.name) {
			alert('Please enter an indicator name.');
			return;
		}

		if (!this.currentIndicator.register) {
			alert('Please select a register.');
			return;
		}

		if (this.currentIndicator.dataElements.length === 0) {
			alert('Please add at least one data element.');
			return;
		}

		// Save to local storage
		const existing = this.indicators.find(i => i.id === this.currentIndicator.id);
		if (existing) {
			Object.assign(existing, this.currentIndicator);
		} else {
			this.indicators.push(this.currentIndicator);
		}

		this.saveIndicators();
		alert('Indicator saved successfully!');
		this.goHome();
	},

	loadIndicators() {
		const stored = localStorage.getItem('equipIndicators');
		this.indicators = stored ? JSON.parse(stored) : [];
	},

	saveIndicators() {
		localStorage.setItem('equipIndicators', JSON.stringify(this.indicators));
	},

	// =============================
	// INDICATOR LIBRARY
	// =============================

	renderIndicatorLibrary() {
		const container = document.getElementById('analyticsIndicatorLibrary');
		if (!container) return;

		if (this.indicators.length === 0) {
			container.innerHTML = `
				<div class="empty-state" style="text-align:center; padding:60px;">
					<i class="bi bi-graph-up" style="font-size:64px; color:#6B7280;"></i>
					<h3 style="color:#374151; margin:20px 0 10px;">No Indicators Yet</h3>
					<p style="color:#6B7280; margin-bottom:20px;">Create your first indicator to start analyzing your data</p>
					<button class="btn btn-primary" onclick="AnalyticsModule.startNewIndicator()">
						<i class="bi bi-plus-circle"></i> Create Indicator
					</button>
				</div>
			`;
			return;
		}

		container.innerHTML = `
			<div class="indicator-grid">
				${this.indicators.map(ind => `
					<div class="indicator-card">
						<div class="indicator-header">
							<h4>${ind.name}</h4>
							<span class="badge badge-${ind.shared ? 'admin' : 'user'}">
								${ind.shared ? 'Shared' : 'Private'}
							</span>
						</div>
						<p class="indicator-description">${ind.description || 'No description'}</p>
						<div class="indicator-meta">
							<small><i class="bi bi-clipboard-data"></i> ${ind.register?.name || 'Unknown'}</small>
							<small><i class="bi bi-bar-chart"></i> ${ind.dataElements.length} elements</small>
							<small><i class="bi bi-funnel"></i> ${ind.disaggregations.length} disagg.</small>
						</div>
						<div class="indicator-actions">
							<button class="btn btn-primary btn-sm" onclick="AnalyticsModule.runIndicatorById(${ind.id})">
								<i class="bi bi-play-circle"></i> Run
							</button>
							<button class="btn btn-outline btn-sm" onclick="AnalyticsModule.editIndicator(${ind.id})">
								<i class="bi bi-pencil"></i> Edit
							</button>
							<button class="btn btn-outline btn-sm" onclick="AnalyticsModule.deleteIndicator(${ind.id})">
								<i class="bi bi-trash"></i>
							</button>
						</div>
					</div>
				`).join('')}
			</div>
		`;
	},

	editIndicator(id) {
		const indicator = this.indicators.find(i => i.id === id);
		if (!indicator) return;

		this.currentIndicator = JSON.parse(JSON.stringify(indicator)); // Deep copy
		this.showView('builder');
		this.renderBuilder();
	},

	deleteIndicator(id) {
		if (!confirm('Delete this indicator? This cannot be undone.')) return;

		this.indicators = this.indicators.filter(i => i.id !== id);
		this.saveIndicators();
		this.renderIndicatorLibrary();
	},

	runIndicatorById(id) {
		const indicator = this.indicators.find(i => i.id === id);
		if (!indicator) return;

		this.currentIndicator = indicator;
		this.runIndicator();
	},

	// =============================
	// ANALYSIS ENGINE
	// =============================

	runIndicator() {
		if (!this.currentIndicator.register) {
			alert('No register selected.');
			return;
		}

		// Get all records for this register
		const records = this.app.data.records.filter(r => r.formId === this.currentIndicator.register.id);

		if (records.length === 0) {
			alert('No data records found for this register.');
			return;
		}

		// Apply filters
		const filtered = this.applyFilters(records);

		// Run data elements
		const results = this.calculateDataElements(filtered);

		// Apply disaggregation
		const disaggregated = this.applyDisaggregation(filtered, results);

		// Render results
		this.showView('results');
		this.renderResults(disaggregated);
	},

	applyFilters(records) {
		// TODO: Implement date and location filters
		return records;
	},

	calculateDataElements(records) {
		const results = {};

		this.currentIndicator.dataElements.forEach(element => {
			let value = 0;

			if (element.type === 'count') {
				value = this.evaluateCountIf(records, element.formula);
			} else if (element.type === 'sum') {
				value = this.evaluateSumIf(records, element.formula);
			} else {
				value = this.evaluateCustom(records, element.formula);
			}

			results[element.name] = value;
		});

		return results;
	},

	evaluateCountIf(records, condition) {
		let count = 0;
		
		records.forEach(rec => {
			try {
				const evaluated = this.evaluateCondition(rec.data, condition);
				if (evaluated) count++;
			} catch (e) {
				console.warn('Evaluation error:', e);
			}
		});

		return count;
	},

	evaluateSumIf(records, fieldOrCondition) {
		// Simple sum of a field
		let sum = 0;
		
		const fieldMatch = fieldOrCondition.match(/\{([^}]+)\}/);
		if (!fieldMatch) return 0;
		
		const fieldName = fieldMatch[1];

		records.forEach(rec => {
			const val = parseFloat(rec.data[fieldName]) || 0;
			sum += val;
		});

		return sum;
	},

	evaluateCustom(records, formula) {
		// TODO: Implement custom formula evaluation
		return 0;
	},

	evaluateCondition(recordData, condition) {
		// Replace {Field Name} with actual values
		let expr = condition;
		
		Object.keys(recordData).forEach(key => {
			const value = recordData[key];
			const token = `{${key}}`;
			const quotedValue = typeof value === 'string' ? `"${value}"` : value;
			expr = expr.split(token).join(quotedValue);
		});

		// Safely evaluate
		try {
			return new Function('return ' + expr)();
		} catch (e) {
			console.warn('Condition eval error:', e, expr);
			return false;
		}
	},

	applyDisaggregation(records, baseResults) {
		if (this.currentIndicator.disaggregations.length === 0) {
			return { total: baseResults, groups: [] };
		}

		// TODO: Implement multi-level disaggregation
		const disaggregated = {
			total: baseResults,
			groups: []
		};

		this.currentIndicator.disaggregations.forEach(disagg => {
			const groupResults = {};

			disagg.groups.forEach(grp => {
				const matching = records.filter(rec => 
					this.evaluateCondition(rec.data, grp.condition)
				);

				groupResults[grp.name] = this.calculateDataElements(matching);
			});

			disaggregated.groups.push({
				field: disagg.field,
				results: groupResults
			});
		});

		return disaggregated;
	},

	// =============================
	// RESULTS RENDERING
	// =============================

	renderResults(data) {
		const container = document.getElementById('analyticsResultsContainer');
		if (!container) return;

		container.innerHTML = `
			<div class="results-view">
				<div class="results-header">
					<h2>${this.currentIndicator.name}</h2>
					<p>${this.currentIndicator.description}</p>
				</div>

				<div class="results-table">
					${this.renderResultsTable(data)}
				</div>

				<div class="results-chart">
					<canvas id="analyticsChart"></canvas>
				</div>

				<div class="results-actions">
					<button class="btn btn-secondary" onclick="AnalyticsModule.exportResults()">
						<i class="bi bi-download"></i> Export CSV
					</button>
					<button class="btn btn-outline" onclick="AnalyticsModule.goHome()">
						<i class="bi bi-house"></i> Back to Library
					</button>
				</div>
			</div>
		`;

		this.renderChart(data);
	},

	renderResultsTable(data) {
		let html = '<table class="table"><thead><tr><th>Category</th>';

		// Headers
		this.currentIndicator.dataElements.forEach(el => {
			html += `<th>${el.name}</th>`;
		});
		html += '</tr></thead><tbody>';

		// Total row
		html += '<tr><td><strong>Total</strong></td>';
		this.currentIndicator.dataElements.forEach(el => {
			html += `<td><strong>${data.total[el.name] || 0}</strong></td>`;
		});
		html += '</tr>';

		// Disaggregated rows
		data.groups.forEach(grp => {
			Object.keys(grp.results).forEach(grpName => {
				html += `<tr><td>${grpName}</td>`;
				this.currentIndicator.dataElements.forEach(el => {
					html += `<td>${grp.results[grpName][el.name] || 0}</td>`;
				});
				html += '</tr>';
			});
		});

		html += '</tbody></table>';
		return html;
	},

	renderChart(data) {
		const canvas = document.getElementById('analyticsChart');
		if (!canvas) return;

		const ctx = canvas.getContext('2d');

		if (this.chart) {
			this.chart.destroy();
		}

		// Prepare data for chart
		const labels = ['Total'];
		const datasets = this.currentIndicator.dataElements.map(el => ({
			label: el.name,
			data: [data.total[el.name] || 0],
			backgroundColor: this.getColor(0),
			borderColor: this.getColor(0),
			borderWidth: 1
		}));

		// Add disaggregated data
		data.groups.forEach(grp => {
			Object.keys(grp.results).forEach(grpName => {
				labels.push(grpName);
				datasets.forEach((ds, idx) => {
					const elName = this.currentIndicator.dataElements[idx].name;
					ds.data.push(grp.results[grpName][elName] || 0);
				});
			});
		});

		this.chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: datasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: this.currentIndicator.name
					},
					legend: {
						position: 'top'
					}
				},
				scales: {
					y: {
						beginAtZero: true
					}
				}
			}
		});
	},

	getColor(index) {
		// Colorblind-friendly palette
		const colors = [
			'#0173B2', '#DE8F05', '#029E73', '#CC78BC',
			'#CA9161', '#949494', '#ECE133', '#56B4E9'
		];
		return colors[index % colors.length];
	},

	exportResults() {
		// TODO: Implement CSV export
		alert('CSV export coming soon!');
	},

	goHome() {
		this.showView('home');
		this.renderIndicatorLibrary();
	},

	populateDateFieldDropdown() {
		const select = document.getElementById('filterDateField');
		if (!select || !this.currentIndicator.register) return;

		const dateFields = this.currentIndicator.register.fields.filter(f => 
			f.type === 'date' || f.type === 'datetime'
		);

		select.innerHTML = '<option value="">-- Select Date Field --</option>' +
			dateFields.map(f => `<option value="${f.label}">${f.label}</option>`).join('');
	}
};

if (typeof module !== 'undefined' && module.exports) {
	module.exports = AnalyticsModule;
}
