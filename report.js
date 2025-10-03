// Reporting Module for EQUIP Health Ghana (generalized)
// Features: Drag/click field token insertion, PEPFAR fiscal calendar, location filtering,
// collapsible metrics panel, CSV export, saved reports (CRUD), create vs view modes.

const ReportsModule = {
	app: null,
	currentForm: null,
	metrics: [], // {id, name, expression, description, active}
	metricsCollapsed: false,
	currentFocusMetric: null,
	facilityFieldLabel: null, // auto-detected (first field whose label or name includes 'facility')
	// Cached field labels for insertion convenience
	fieldLabels: [],
	lastWeekStartISO: null,
	lastWeekEndISO: null,
	editingReportId: null,
	viewMode: 'cards', // or 'list'

	init(appInstance) {
		this.app = appInstance;
	},

	showReportUI() {
			// Default landing: Reports Home
			this.showSection('home');
			this.renderSavedReports();
	},

		showSection(which) {
			const home = document.getElementById('reportsHomeSection');
			const editor = document.getElementById('reportEditorSection');
			const viewer = document.getElementById('reportViewerSection');
			if (home) home.style.display = (which === 'home') ? '' : 'none';
			if (editor) editor.style.display = (which === 'editor') ? '' : 'none';
			if (viewer) viewer.style.display = (which === 'viewer') ? '' : 'none';
		},

		startCreateNew() {
			this.currentForm = null;
			this.metrics = [];
			this.editingReportId = null;
			this.currentReportName = null;
			this.populateRegisterSelect();
			this.renderFieldPalette();
			this.renderMetricsConfig();
			const title = document.getElementById('reportEditorTitle');
			if (title) title.textContent = 'Create Report';
			this.showSection('editor');
		},

		goHome() {
			this.currentFocusMetric = null;
			this.showSection('home');
			this.renderSavedReports();
		},

  
	initWeekStart() {
		const refInput = document.getElementById('reportWeekStart');
		if (refInput) {
			refInput.addEventListener('change', ()=>{ this.updateFiscalLabels(); this.autoEndDate(); });
			if (!refInput.value) {
				const now = new Date();
				refInput.value = now.toISOString().split('T')[0];
			}
			this.autoEndDate();
		}
	},

	autoEndDate() {
		const refStr = document.getElementById('reportWeekStart')?.value;
		if (!refStr) return;
		const refDate = new Date(refStr + 'T00:00:00');
		const day = refDate.getDay(); // 0=Sun..6=Sat
		// Compute Monday of this week
		const monday = new Date(refDate);
		const shift = (day === 0 ? -6 : 1 - day); // Sunday -> back 6, Mon->0, Tue->-1, ...
		monday.setDate(monday.getDate() + shift);
		const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
		const endLabel = document.getElementById('reportWeekEndLabel');
		if (endLabel) endLabel.textContent = sunday.toISOString().split('T')[0];
		// Replace stored value with the computed Monday so subsequent logic uses normalized week start
		document.getElementById('reportWeekStart').dataset.normalizedMonday = monday.toISOString().split('T')[0];
		this.lastWeekStartISO = monday.toISOString().split('T')[0];
		this.lastWeekEndISO = sunday.toISOString().split('T')[0];
	},

	populateRegisterSelect() {
		const sel = document.getElementById('reportRegister');
		if (!sel) return;
		sel.innerHTML = '<option value="">-- Select Register --</option>' + this.app.data.forms.map(f => `<option value='${f.id}'>${f.name}</option>`).join('');
	},

	onRegisterChange() {
		const formId = parseInt(document.getElementById('reportRegister').value, 10);
		this.currentForm = this.app.data.forms.find(f => f.id === formId) || null;
		this.metrics = [];
		if (this.currentForm) {
			this.fieldLabels = this.currentForm.fields.map(f => f.label);
			this.autoDetectFacilityField();
			this.ensureDefaultMetrics();
			this.renderFieldPalette();
		} else {
			this.fieldLabels = [];
		}
		this.renderMetricsConfig();
	},

	ensureDefaultMetrics() {
		if (this.metrics.length > 0) return;
		if (this.currentForm && /prep/i.test(this.currentForm.name)) {
			const t = Date.now();
			// Try to discover readable field labels actually present
			const findLabel = (matcherFnArr) => {
				for (const fn of matcherFnArr) {
					const f = this.currentForm.fields.find(field => fn(field.label));
					if (f) return f.label;
				}
				return null;
			};
			const visitLabel = findLabel([
				l => /visit\s*type/i.test(l),
				l => /visit/i.test(l)
			]) || 'visit_type';
			const statusLabel = findLabel([
				l => /pregnancy\s*status/i.test(l),
				l => /pregnancy/i.test(l),
				l => /pregnant/i.test(l),
				l => /breast/i.test(l)
			]) || 'pregnancy_status';
			const tokenVisit = '${' + visitLabel + '}';
			const tokenStatus = '${' + statusLabel + '}';
			this.metrics = [
				{ id: t+1, name: 'PrEP_New_Pregnant', expression: `${tokenVisit} = "New" && ${tokenStatus} = "Pregnant"`, description: 'New PrEP Pregnant Women', active: true },
				{ id: t+2, name: 'PrEP_New_Breastfeeding', expression: `${tokenVisit} = "New" && ${tokenStatus} = "Breastfeeding"`, description: 'New PrEP Breastfeeding Women', active: true },
				{ id: t+3, name: 'PrEP_CT_Pregnant', expression: `${tokenVisit} != "New" && ${tokenStatus} = "Pregnant"`, description: 'Continuation Pregnant', active: true },
				{ id: t+4, name: 'PrEP_CT_Breastfeeding', expression: `${tokenVisit} != "New" && ${tokenStatus} = "Breastfeeding"`, description: 'Continuation Breastfeeding', active: true }
			];
		}
	},

	addMetric() {
		const id = Date.now();
		this.metrics.unshift({ id, name: 'Metric_'+id, expression: '', description: '', active: true });
		this.newMetricFocusId = id;
		this.renderMetricsConfig();
	},

	// ---------------- Saved Reports Management ----------------
		newReport() { this.startCreateNew(); },
	saveReport() {
		if (!this.currentForm) { alert('Select a register first'); return; }
		if (!this.metrics.length) { if (!confirm('No metrics defined. Save anyway?')) return; }
		const name = this.currentReportName || prompt('Report name');
		if (!name) return;
		const reportObj = {
			id: this.editingReportId || Date.now(),
			name,
			formId: this.currentForm.id,
			metrics: JSON.parse(JSON.stringify(this.metrics)),
			createdAt: Date.now(),
			updatedAt: Date.now()
		};
		const existingIdx = this.app.data.reports.findIndex(r => r.id === reportObj.id);
		if (existingIdx !== -1) {
			this.app.data.reports[existingIdx] = reportObj;
		} else {
			this.app.data.reports.push(reportObj);
		}
		this.app.saveToStorage();
		this.editingReportId = reportObj.id;
		this.currentReportName = reportObj.name;
		this.renderSavedReports();
		alert('Report saved');
	},
	deleteReport(id) {
		if (!confirm('Delete this saved report?')) return;
		this.app.data.reports = this.app.data.reports.filter(r => r.id !== id);
		if (this.editingReportId === id) {
			this.editingReportId = null; this.metrics = []; this.currentReportName = null; this.renderMetricsConfig();
		}
		this.app.saveToStorage();
		this.renderSavedReports();
	},
	loadReport(id) {
		const rep = this.app.data.reports.find(r => r.id === id);
		if (!rep) return;
			// Open in Viewer mode (run-time filters visible)
			this.currentForm = this.app.data.forms.find(f => f.id === rep.formId) || null;
			const registerSelect = document.getElementById('reportRegister');
			if (registerSelect) registerSelect.value = String(rep.formId);
			if (this.currentForm) {
				this.fieldLabels = this.currentForm.fields.map(f => f.label);
				this.autoDetectFacilityField();
			}
			this.metrics = JSON.parse(JSON.stringify(rep.metrics));
			this.editingReportId = rep.id;
			this.currentReportName = rep.name;
			// Prepare viewer filters
			this.initWeekStart();
			this.populateRegionFilter();
			this.renderResultsPlaceholder();
			this.updateFiscalLabels();
			const viewerTitle = document.getElementById('reportViewerTitle');
			if (viewerTitle) viewerTitle.textContent = `View Report • ${rep.name}`;
			this.showSection('viewer');
	},
		editReport(id) {
			const rep = this.app.data.reports.find(r => r.id === id);
			if (!rep) return;
			// Open editor with report loaded
			this.currentForm = this.app.data.forms.find(f => f.id === rep.formId) || null;
			const registerSelect = document.getElementById('reportRegister');
			if (registerSelect) registerSelect.value = String(rep.formId);
			if (this.currentForm) {
				this.fieldLabels = this.currentForm.fields.map(f => f.label);
				this.autoDetectFacilityField();
				this.renderFieldPalette();
			}
			this.metrics = JSON.parse(JSON.stringify(rep.metrics));
			this.editingReportId = rep.id;
			this.currentReportName = rep.name;
			this.renderMetricsConfig();
			const title = document.getElementById('reportEditorTitle');
			if (title) title.textContent = `Edit Report • ${rep.name}`;
			this.showSection('editor');
		},
	toggleReportViewMode() {
		this.viewMode = this.viewMode === 'cards' ? 'list' : 'cards';
		this.renderSavedReports();
	},
	renameReport(id) {
		const rep = this.app.data.reports.find(r => r.id === id);
		if (!rep) return;
		const newName = prompt('New name', rep.name);
		if (!newName) return;
		rep.name = newName;
		rep.updatedAt = Date.now();
		this.app.saveToStorage();
		if (this.editingReportId === id) this.currentReportName = newName;
		this.renderSavedReports();
	},
	renderSavedReports() {
		const container = document.getElementById('savedReportsContainer');
		if (!container) return;
		const reports = this.app.data.reports || [];
		if (!reports.length) {
				container.innerHTML = `<div style='color:#6B7280;font-size:12px;'>No saved reports yet.</div>`;
			return;
		}
		if (this.viewMode === 'list') {
			container.innerHTML = `<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;'>
				<strong style='font-size:13px;'>Saved Reports (${reports.length})</strong>
				<div style='display:flex; gap:6px;'>
					<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.toggleReportViewMode()'>Cards</button>
				</div>
			</div>
			<div class='table-wrapper'><table><thead><tr><th>Name</th><th>Register</th><th>Metrics</th><th>Actions</th></tr></thead><tbody>
				${reports.map(r=>`<tr ${r.id===this.editingReportId?'style="background:#f1f5f9;"':''}><td>${r.name}</td><td>${(this.app.data.forms.find(f=>f.id===r.formId)||{}).name||'?'} </td><td>${r.metrics.length}</td><td>
				<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.loadReport(${r.id})'>View</button>
				<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.editReport(${r.id})'>Edit</button>
				<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.renameReport(${r.id})'>Rename</button>
				<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.deleteReport(${r.id})'>Del</button></td></tr>`).join('')}
			</tbody></table></div>`;
		} else {
			container.innerHTML = `<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;'>
				<strong style='font-size:13px;'>Saved Reports (${reports.length})</strong>
				<div style='display:flex; gap:6px;'>
					<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.toggleReportViewMode()'>List</button>
				</div>
			</div>
			<div style='display:flex; flex-wrap:wrap; gap:12px;'>
				${reports.map(r=>`<div class='glass' style='padding:12px; flex:1 1 240px; border:${r.id===this.editingReportId?'2px solid #0157ae':'1px solid #cbd5e1'};'>
				<div style='font-weight:600; font-size:14px; margin-bottom:4px;'>${r.name}</div>
				<div style='font-size:11px; color:#64748b;'>Register: ${(this.app.data.forms.find(f=>f.id===r.formId)||{}).name||'?'}<br>Metrics: ${r.metrics.length}</div>
				<div style='display:flex; gap:4px; margin-top:8px;'>
						<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.loadReport(${r.id})'>View</button>
						<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.editReport(${r.id})'>Edit</button>
						<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.renameReport(${r.id})'>Rename</button>
						<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.deleteReport(${r.id})'>Del</button>
				</div>
			</div>`).join('')}
			</div>`;
		}
	},

	updateMetricField(id, field, value) {
		const m = this.metrics.find(x => x.id === id);
		if (!m) return;
		m[field] = value;
	},

	toggleMetric(id) {
		const m = this.metrics.find(x => x.id === id);
		if (m) { m.active = !m.active; this.renderMetricsConfig(); }
	},

	deleteMetric(id) {
		if (!confirm('Delete this metric?')) return;
		this.metrics = this.metrics.filter(m => m.id !== id);
		this.renderMetricsConfig();
	},

	renderMetricsConfig() {
		const container = document.getElementById('metricsConfig');
		if (!container) return;
		if (!this.currentForm) { container.innerHTML = '<div style="color:#666;">Select a register to configure metrics.</div>'; return; }
		if (this.metricsCollapsed) {
			container.innerHTML = `<button class="btn btn-outline btn-sm" style="width:auto;" onclick="ReportsModule.toggleMetricsCollapse()">Show Metrics (${this.metrics.length})</button>`;
			return;
		}
		container.innerHTML = `
			<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;'>
				<strong>Metrics (${this.metrics.length})</strong>
				<div style='display:flex; gap:8px;'>
					<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.addMetric()'>Add</button>
					<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.toggleMetricsCollapse()'>Hide</button>
				</div>
			</div>
			${this.metrics.map(m => `
				<div class='list-item' style='align-items:flex-start;'>
					<div style='flex:1;'>
						<input type='text' class='form-input' style='margin-bottom:6px;' value='${m.name}' onchange='ReportsModule.updateMetricField(${m.id},"name", this.value)'>
						<textarea data-metric-id='${m.id}' class='form-input' rows='2' placeholder='Expression' onfocus='ReportsModule.currentFocusMetric=${m.id}' onchange='ReportsModule.updateMetricField(${m.id},"expression", this.value)'>${m.expression.replace(/</g,'&lt;')}</textarea>
						<input type='text' class='form-input' style='margin-top:6px;' placeholder='Description (optional)' value='${m.description||''}' onchange='ReportsModule.updateMetricField(${m.id},"description", this.value)'>
						<label style='display:flex;align-items:center; gap:6px; margin-top:4px; font-size:12px;'>
							<input type='checkbox' ${m.active?'checked':''} onchange='ReportsModule.toggleMetric(${m.id})'> Active
						</label>
					</div>
					<div style='display:flex; flex-direction:column; gap:6px;'>
						<button class='btn btn-outline btn-sm' style='width:auto; padding:6px 10px;' onclick='ReportsModule.deleteMetric(${m.id})'>Del</button>
					</div>
				</div>`).join('')}
		`;
		if (this.newMetricFocusId) {
			const ta = container.querySelector(`textarea[data-metric-id='${this.newMetricFocusId}']`);
			if (ta) { ta.focus(); this.currentFocusMetric = this.newMetricFocusId; }
			this.newMetricFocusId = null;
		}
	},

	toggleMetricsCollapse() { this.metricsCollapsed = !this.metricsCollapsed; this.renderMetricsConfig(); },

	renderFieldPalette() {
		const pal = document.getElementById('reportFieldPalette');
		if (!pal) return;
		if (!this.currentForm) { pal.innerHTML = ''; return; }
		pal.innerHTML = this.currentForm.fields.map(f => {
			const choices = (f.choices && f.choices.length) ? ` (${f.choices.slice(0,5).join(', ')}${f.choices.length>5?'…':''})` : '';
			const typeTag = f.type ? `<span style="color:#0369a1;font-size:10px; background:#e0f2fe; padding:2px 4px; border-radius:4px; margin-left:4px;">${f.type}</span>` : '';
			const labelEsc = f.label.replace(/"/g,'&quot;');
			return `<div class='report-field-chip' draggable='true' title='${f.label}${choices ? ' Values:'+choices : ''}' ondragstart='ReportsModule.onFieldDrag(event,"${labelEsc}")' onclick='ReportsModule.insertToken("${labelEsc}")'>${f.label}${typeTag}${choices}</div>`;
		}).join('');
	},

	onFieldDrag(e, label) {
		e.dataTransfer.setData('text/plain', label);
	},

	insertToken(label) {
		if (!this.currentFocusMetric) return;
		const m = this.metrics.find(x => x.id === this.currentFocusMetric);
		if (!m) return;
		m.expression = (m.expression || '') + (m.expression ? ' ' : '') + '${' + label + '}';
		this.renderMetricsConfig();
	},

	handleExpressionDrop(e) {
		e.preventDefault();
		const label = e.dataTransfer.getData('text/plain');
		if (label) this.insertToken(label);
	},
	allowDrop(e) { e.preventDefault(); },

	renderResultsPlaceholder() {
		const res = document.getElementById('reportResults');
		if (res) {
			res.innerHTML = '<div style="color:#6B7280; font-size:14px;">Run a report to see results.</div>';
		}
	},

	runReport() {
		if (!this.currentForm) { alert('Select a register'); return; }
		const refInput = document.getElementById('reportWeekStart');
		const refStr = refInput.value;
		if (!refStr) { alert('Select a date'); return; }
		const mondayStr = refInput.dataset.normalizedMonday || refStr;
		const weekStart = new Date(mondayStr + 'T00:00:00');
		const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7); // exclusive end
	this.lastWeekStartISO = weekStart.toISOString().split('T')[0];
	const sunday = new Date(weekStart); sunday.setDate(weekStart.getDate()+6); this.lastWeekEndISO = sunday.toISOString().split('T')[0];

		const dateFieldLabel = this.guessDateField();

		const records = this.app.data.records.filter(r => r.formId === this.currentForm.id);
		const activeMetrics = this.metrics.filter(m => m.active);
		const metricsTotals = {};
		activeMetrics.forEach(m => metricsTotals[m.name] = 0);

		const evaluate = (expr, values) => {
			if (!expr) return false;
			let safe = expr;
			safe = safe.replace(/\$\{([^}]+)\}/g, (m,p1) => JSON.stringify(values[p1.trim()]));
			safe = safe.replace(/(^|[^!<>=])=([^=])/g, '$1==$2');
			if (!/^[0-9A-Za-z_"'\s\[\],.:;\-<>=!&|()+]*$/.test(safe)) return false;
			try { return !!Function(`return (${safe})`)(); } catch { return false; }
		};

		const inWeek = (dateStr) => {
			if (!dateStr) return false;
			const d = new Date(dateStr);
			return d >= weekStart && d < weekEnd;
		};

		// Location filters only if facility field chosen
		const selectedFacilityField = this.facilityFieldLabel;
		const regionFilter = document.getElementById('reportRegion')?.value || '';
		const zoneFilter = document.getElementById('reportZone')?.value || '';
		const districtFilter = document.getElementById('reportDistrict')?.value || '';
		const facilityFilter = document.getElementById('reportFacility')?.value || '';

		records.forEach(rec => {
			const values = {}; // map label + name -> value
			this.currentForm.fields.forEach(f => { const v = rec.data[f.label]; values[f.label] = v; if (f.name) values[f.name] = v; });
			const recordDate = values[dateFieldLabel];
			if (!inWeek(recordDate)) return;
			// Apply location filters
			if (selectedFacilityField) {
				const facilityValue = values[selectedFacilityField];
				if (facilityValue) {
					const facObj = this.app.facilities.find(f => f.Facility === facilityValue);
					if (facObj) {
						if (regionFilter && facObj.Region !== regionFilter) return;
						if (zoneFilter && facObj.Zone !== zoneFilter) return;
						if (districtFilter && facObj.District !== districtFilter) return;
						if (facilityFilter && facObj.Facility !== facilityFilter) return;
					} else if (regionFilter || zoneFilter || districtFilter || facilityFilter) {
						// If filtering and we can't resolve facility, skip
						return;
					}
				} else if (regionFilter || zoneFilter || districtFilter || facilityFilter) {
					return; // missing facility data
				}
			}
			activeMetrics.forEach(m => {
				if (evaluate(m.expression, values)) {
					metricsTotals[m.name]++;
				}
			});
		});
		this.renderResults(metricsTotals);
	},

	renderResults(metricTotals) {
		const res = document.getElementById('reportResults');
		if (!res) return;
		const metricRows = Object.keys(metricTotals).map(k => `<tr><td>${k}</td><td>${metricTotals[k]}</td></tr>`).join('');
		const period = this.getFiscalPeriod();
	const range = (this.lastWeekStartISO && this.lastWeekEndISO) ? ` (${this.lastWeekStartISO} → ${this.lastWeekEndISO})` : '';
	const periodMeta = period ? `<div style='font-size:12px; color:#6B7280; margin-bottom:8px;'>FY: ${period.fy} • Quarter: ${period.quarter} • Month: ${period.monthLabel} • Week: ${period.weekLabel}${range}</div>` : '';
		res.innerHTML = `
			<h4>Summary</h4>
			${periodMeta}
			<div class='table-wrapper'>
				<table>
					<thead><tr><th>Metric</th><th>Count</th></tr></thead>
					<tbody>${metricRows || '<tr><td colspan=2>No matching records</td></tr>'}</tbody>
				</table>
			</div>
			<canvas id='reportChart' height='160' style='margin-top:20px;'></canvas>
			<div style='margin-top:16px;'>
				<button class='btn btn-outline btn-sm' style='width:auto;' onclick='ReportsModule.exportCSV()'>Export CSV</button>
			</div>
		`;

		this.renderChart(metricTotals);
	},

	renderChart(metricTotals) {
		const canvas = document.getElementById('reportChart');
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0,0,canvas.width,canvas.height);
		const labels = Object.keys(metricTotals);
		const values = labels.map(l => metricTotals[l]);
		if (values.length === 0) return;
		const max = Math.max(...values, 1);
		const barWidth = Math.min(60, (canvas.width - 40) / values.length - 10);
		labels.forEach((lab, i) => {
			const x = 30 + i * (barWidth + 20);
			const h = (values[i] / max) * (canvas.height - 50);
			const y = canvas.height - 30 - h;
			ctx.fillStyle = '#0157ae';
			ctx.fillRect(x, y, barWidth, h);
			ctx.fillStyle = '#000';
			ctx.font = '12px sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(values[i], x + barWidth/2, y - 4);
			ctx.save();
			ctx.translate(x + barWidth/2, canvas.height - 15);
			ctx.rotate(-Math.PI/6);
			ctx.fillText(lab, 0, 0);
			ctx.restore();
		});
	},

	// LOCATION FILTERS
	populateRegionFilter() {
		const regSel = document.getElementById('reportRegion');
		if (!regSel) return;
		const regions = [...new Set(this.app.facilities.map(f => f.Region))].filter(Boolean).sort();
		regSel.innerHTML = '<option value="">All Regions</option>' + regions.map(r=>`<option value='${r}'>${r}</option>`).join('');
		['reportZone','reportDistrict','reportFacility'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = `<option value="">All ${id.replace('report','')}</option>`; });
		regSel.onchange = ()=> this.populateZoneFilter();
	},
	populateZoneFilter() {
		const region = document.getElementById('reportRegion')?.value;
		const zoneSel = document.getElementById('reportZone'); if (!zoneSel) return;
		let filtered = this.app.facilities;
		if (region) filtered = filtered.filter(f => f.Region === region);
		const zones = [...new Set(filtered.map(f=>f.Zone))].filter(Boolean).sort();
		zoneSel.innerHTML = '<option value="">All Zones</option>' + zones.map(z=>`<option value='${z}'>${z}</option>`).join('');
		zoneSel.onchange = ()=> this.populateDistrictFilter();
		this.populateDistrictFilter();
	},
	populateDistrictFilter() {
		const region = document.getElementById('reportRegion')?.value;
		const zone = document.getElementById('reportZone')?.value;
		const distSel = document.getElementById('reportDistrict'); if (!distSel) return;
		let filtered = this.app.facilities;
		if (region) filtered = filtered.filter(f => f.Region === region);
		if (zone) filtered = filtered.filter(f => f.Zone === zone);
		const districts = [...new Set(filtered.map(f=>f.District))].filter(Boolean).sort();
		distSel.innerHTML = '<option value="">All Districts</option>' + districts.map(d=>`<option value='${d}'>${d}</option>`).join('');
		distSel.onchange = ()=> this.populateFacilityFilter();
		this.populateFacilityFilter();
	},
	populateFacilityFilter() {
		const region = document.getElementById('reportRegion')?.value;
		const zone = document.getElementById('reportZone')?.value;
		const district = document.getElementById('reportDistrict')?.value;
		const facSel = document.getElementById('reportFacility'); if (!facSel) return;
		let filtered = this.app.facilities;
		if (region) filtered = filtered.filter(f => f.Region === region);
		if (zone) filtered = filtered.filter(f => f.Zone === zone);
		if (district) filtered = filtered.filter(f => f.District === district);
		const facilities = [...new Set(filtered.map(f=>f.Facility))].filter(Boolean).sort();
		facSel.innerHTML = '<option value="">All Facilities</option>' + facilities.map(f=>`<option value='${f}'>${f}</option>`).join('');
	},

	autoDetectFacilityField() {
		if (!this.currentForm) { this.facilityFieldLabel = null; return; }
		const cand = this.currentForm.fields.find(f => /facility/i.test(f.label) || (f.name && /facility/i.test(f.name)));
		this.facilityFieldLabel = cand ? cand.label : null;
	},

	// PEPFAR Fiscal Period
	updateFiscalLabels() {
		const period = this.getFiscalPeriod();
		const el = document.getElementById('fiscalSummary');
		if (el && period) {
			el.textContent = `FY ${period.fy} • ${period.quarter} • ${period.monthLabel} • ${period.weekLabel}`;
		}
	},

	getFiscalPeriod() {
		const startStr = document.getElementById('reportWeekStart')?.value;
		if (!startStr) return null;
		const startDate = new Date(startStr + 'T00:00:00');
		// Fiscal year starts Oct 1. FY label equals calendar year of Jan-Sep +1. E.g., Oct 2024 -> FY25.
		const fy = startDate.getMonth() >= 9 ? startDate.getFullYear() + 1 : startDate.getFullYear();
		const month = startDate.getMonth(); // 0=Jan
		// PEPFAR Q1=Oct-Dec, Q2=Jan-Mar, Q3=Apr-Jun, Q4=Jul-Sep
		let quarterIdx;
		if (month >=9) quarterIdx = 1; else if (month<=2) quarterIdx = 2; else if (month<=5) quarterIdx = 3; else quarterIdx = 4;
		const quarter = `FY${String(fy).slice(-2)}Q${quarterIdx}`;
		const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
		const monthLabel = monthLabels[month];
		// Week number RESET each calendar month (per requirement): find first Monday in the month then count
		const monthStart = new Date(startDate.getFullYear(), month, 1);
		const msDow = monthStart.getDay();
		const monthOffset = (msDow === 0 ? 1 : msDow === 1 ? 0 : 8 - msDow); // first Monday on/after day 1
		const firstMondayMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() + monthOffset);
		let diffDaysMonth = Math.floor((startDate - firstMondayMonth) / 86400000);
		let weekInMonth = diffDaysMonth >= 0 ? Math.floor(diffDaysMonth / 7) + 1 : 1; // if before first Monday treat as week 1 safeguard
		if (weekInMonth > 5) weekInMonth = 5; // cap at 5 weeks
		const weekLabel = `Wk${weekInMonth}`;
		return { fy: `FY${String(fy).slice(-2)}`, quarter, monthLabel, weekLabel };
	},

	exportCSV() {
		const period = this.getFiscalPeriod();
		const rows = [['Metric','Count','FiscalYear','Quarter','Month','WeekLabel','WeekStart','WeekEnd']];
		const weekStartStr = this.lastWeekStartISO || '';
		const weekEndStr = this.lastWeekEndISO || '';
		const summaryTable = document.querySelector('#reportResults table tbody');
		if (!summaryTable) { alert('Run report first'); return; }
		summaryTable.querySelectorAll('tr').forEach(tr => {
			const cells = tr.querySelectorAll('td');
			if (cells.length === 2) {
				const metric = cells[0].textContent;
				const count = cells[1].textContent;
				rows.push([metric, count, period?.fy||'', period?.quarter||'', period?.monthLabel||'', period?.weekLabel||'', weekStartStr||'', weekEndStr]);
			}
		});
		const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
			a.download = `report_${this.currentReportName ? this.currentReportName.replace(/\s+/g,'_') : 'period'}_${weekStartStr||'ref'}.csv`;
		document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
	},

		resetViewer() {
			this.initWeekStart();
			this.populateRegionFilter();
			this.renderResultsPlaceholder();
			this.updateFiscalLabels();
		},
	applyMode() {
		const mode = this.mode || 'view';
		const viewEls = document.querySelectorAll('.report-view-only');
		viewEls.forEach(el => { el.style.display = (mode === 'view') ? '' : 'none'; });
	},

	guessField(candidates) {
		if (!this.currentForm) return null;
		const labels = this.currentForm.fields.map(f => f.label.toLowerCase());
		for (const c of candidates) {
			const idx = labels.indexOf(c.toLowerCase());
			if (idx !== -1) return this.currentForm.fields[idx].label;
		}
		return null;
	},

	guessDateField() {
		if (!this.currentForm) return null;
		const dateField = this.currentForm.fields.find(f => /date/i.test(f.label) || f.type === 'date' || f.type === 'datetime');
		return dateField ? dateField.label : null;
	}
};

if (typeof module !== 'undefined' && module.exports) {
	module.exports = ReportsModule;
}
