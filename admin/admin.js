// --- CONFIGURATION ---
let masterEngineUrl = localStorage.getItem('hs_engine_url') || null;
let masterSheetId = localStorage.getItem('hydrostack_master_db') || null;
let allSubmissions = []; 

// PERMANENT PERSISTENCE GATEKEEPER
window.onload = async function () {
    // If the admin has an engine URL, they belong inside the app. No exceptions.
    if (masterEngineUrl) {
        await launchDashboard();
    }
};

document.getElementById('auth-btn').addEventListener('click', async () => {
    const urlInput = document.getElementById('engine-url-input').value.trim();
    
    // STRICT GUARDRAIL: Must be a Google Script URL and MUST end in /exec
    if (!urlInput.startsWith('https://script.google.com/') || !urlInput.endsWith('/exec')) {
        return alert("Invalid Engine URL. It must end with '/exec'. Please copy the Web App URL from your deployment.");
    }
    
    // If connecting a NEW engine, wipe the OLD database memory so it builds fresh
    if (masterEngineUrl !== urlInput) {
        localStorage.removeItem('hydrostack_master_db');
        masterSheetId = null;
    }
    
    masterEngineUrl = urlInput;
    localStorage.setItem('hs_engine_url', masterEngineUrl);
    
    document.getElementById('auth-btn').innerText = "Connecting & Building DB...";
    await launchDashboard();
});

async function launchDashboard() {
    // Optimistic UI: Flash directly past the login screen instantly
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    
    await initMasterWorkspace();
    
    // Prevent interval duplication on page refreshes
    if (!window.hsSyncInterval) {
        window.hsSyncInterval = setInterval(showRefreshToast, 5 * 60 * 1000); 
    }
}

// THE UNIFIED APPS SCRIPT RELAY (WITH ENHANCED ERROR DETECTION)
async function gasRequest(payload) {
    try {
        const res = await fetch(masterEngineUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload) 
        });
        
        // Catch Google HTML error pages (like login screens or 404s) before they crash the app
        const textResponse = await res.text();
        try {
            return JSON.parse(textResponse);
        } catch (parseError) {
            console.error("CRITICAL: Google returned HTML instead of JSON. Raw response:", textResponse);
            throw new Error("Invalid response from Google. Deployment settings are likely incorrect.");
        }
    } catch (error) {
        console.error("Network relay failed:", error);
        throw error;
    }
}

async function initMasterWorkspace() {
    // Dual-layer state defense check
    if (!masterSheetId) {
        masterSheetId = localStorage.getItem('hydrostack_master_db');
    }
    
    // If we have a healthy sheet ID, pull down data and exit setup execution
    if (masterSheetId && masterSheetId !== "null" && masterSheetId !== "undefined") { 
        loadDashboardData(); 
        return; 
    }
    
    // If missing from browser storage, the self-healing Apps Script will look it up or initialize it safely
    try {
        const res = await gasRequest({ action: 'init' });
        if (res.success) {
            masterSheetId = res.spreadsheetId;
            localStorage.setItem('hydrostack_master_db', masterSheetId);
            loadDashboardData();
            document.getElementById('auth-btn').innerText = "Connect Workspace"; // Reset button
        } else {
            alert("Engine initialization rejected: " + (res.error || "Unknown Error"));
            resetLoginState();
        }
    } catch (e) {
        alert("Connection Blocked! Make sure your URL ends in '/exec' and your deployment access is set to 'Anyone'.");
        resetLoginState();
    }
}

// Helper to kick user back to login safely if it fails
function resetLoginState() {
    document.getElementById('auth-btn').innerText = "Connect Workspace";
    document.getElementById('dashboard-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
}

async function appendRowToSheet(tabName, valuesArray) {
    await gasRequest({ action: 'append', sheetId: masterSheetId, tabName: tabName, values: valuesArray });
}

async function getRowsFromSheet(tabName) {
    try {
        const res = await gasRequest({ action: 'get', sheetId: masterSheetId, tabName: tabName });
        return res.values || [];
    } catch (e) { return []; }
}

async function loadDashboardData() {
    const data = await getRowsFromSheet("Modules");
    const tbody = document.getElementById('modules-list');
    const formSelect = document.getElementById('form-target-module');
    const reportSelect = document.getElementById('report-module-select');
    
    tbody.innerHTML = '';
    formSelect.innerHTML = '<option>Select a module...</option>';
    reportSelect.innerHTML = '<option value="">Select a module...</option>';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No modules found. Create one!</td></tr>';
    } else {
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family: monospace; color: var(--accent);">${row[0]}</td>
                <td>${row[1]}</td><td>${row[2]}</td>
                <td><span class="badge" style="background: var(--success);">${row[5]}</span></td>
                <td><button class="btn-secondary" style="padding: 5px 10px; font-size: 0.7rem;" onclick="copySmartKey('${row[0]}', '${row[4]}', '${row[1]}', '${row[2]}', '${row[3]}')">Copy Link</button></td>
            `;
            tbody.appendChild(tr);
            
            const opt = document.createElement('option');
            opt.value = row[0]; opt.innerText = `${row[0]} - ${row[1]}`;
            formSelect.appendChild(opt.cloneNode(true));
            reportSelect.appendChild(opt);
        });
    }

    allSubmissions = await getRowsFromSheet("Submissions");
    checkNotifications();
}

function checkNotifications() {
    const lastCount = parseInt(localStorage.getItem('hs_last_sub_count')) || 0;
    if (allSubmissions.length > lastCount) {
        document.getElementById('notif-badge').style.display = 'inline-block';
    }
}

document.getElementById('submit-module-btn').addEventListener('click', async () => {
    const btn = document.getElementById('submit-module-btn');
    const name = document.getElementById('mod-name').value;
    const emptyMsg = document.getElementById('empty-module-msg'); 
    if (emptyMsg) emptyMsg.style.display = 'none';
    const loc = document.getElementById('mod-loc').value;
    const desc = document.getElementById('mod-desc').value;
    
    // NEW: Extract the assigned workers (defaults to "Any" if left blank)
    const workers = document.getElementById('mod-workers').value || "Any"; 

    if (!name) return alert("Module Name is required.");
    btn.innerText = "Creating...";

    const moduleId = 'MOD-' + Math.floor(1000 + Math.random() * 9000);
    const passcode = Math.floor(1000 + Math.random() * 9000).toString();
    const date = new Date().toLocaleDateString();

    // 1. Send it to Google in the background (Now includes the 8th column: workers)
    await appendRowToSheet("Modules", [moduleId, name, loc, desc, passcode, "Active", date, workers]);

    // 2. INSTANT UI UPDATE (Bypass the Google delay)
    // Add to the Table
    const tbody = document.getElementById('modules-list');
    const tr = document.createElement('tr');
    
    // NEW: The copySmartKey button now passes all 5 details so the worker app knows the project context
    tr.innerHTML = `
        <td style="font-family: monospace; color: var(--accent);">${moduleId}</td>
        <td>${name}</td><td>${loc}</td>
        <td><span class="badge" style="background: var(--success);">Active</span></td>
        <td><button class="btn-secondary" style="padding: 5px 10px; font-size: 0.7rem;" onclick="copySmartKey('${moduleId}', '${passcode}', '${name}', '${loc}', '${desc}')">Copy Link</button></td>
    `;
    tbody.appendChild(tr); 

    // Add to the Dropdowns
    const opt = document.createElement('option');
    opt.value = moduleId;
    opt.innerText = `${moduleId} - ${name}`;
    document.getElementById('form-target-module').appendChild(opt.cloneNode(true));
    document.getElementById('report-module-select').appendChild(opt);

    // 3. Clean up the Modal
    closeModal('modal-new-module');
    btn.innerText = "Create Module";
    document.getElementById('mod-name').value = '';
    document.getElementById('mod-loc').value = '';
    document.getElementById('mod-desc').value = '';
    document.getElementById('mod-workers').value = ''; // CLEAN UP THE NEW FIELD

    // NEW: Pass all 5 details to the auto-copy timeout
    setTimeout(() => { copySmartKey(moduleId, passcode, name, loc, desc); }, 500);
});

function copySmartKey(moduleId, pin, name, loc, desc) {
    // We now pack the extra details into the payload for the worker to see
    // Inside copySmartKey:
const accessData = { db: masterSheetId, proj: moduleId, pin: pin, name: name, loc: loc, desc: desc, engine: masterEngineUrl }; // <-- Added engine!
    const smartKey = btoa(JSON.stringify(accessData));
    
    // Forces the production URL for the Magic Link even when testing locally
    const currentDomain = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? 'https://usehydrostack.com' : window.location.origin;
    
    // NOTICE: &pin=... has been removed for security! Worker must type it.
    const magicLink = `${currentDomain}/worker/index.html?module=${smartKey}`;
    
    const clipboardText = `🏗️ HYDROSTACK MODULE ACCESS\n\nModule: ${name}\nID: ${moduleId}\nPasscode: ${pin}\n\nTap this link to download the form:\n${magicLink}\n\nOr use manual key:\n${smartKey}`;
    navigator.clipboard.writeText(clipboardText);
    alert(`✅ Secure Magic Link Copied!`);
}

// THE NEW FORM BUILDER WITH OPTIONS LOGIC
function addFormField() {
    const container = document.getElementById('form-fields-container');
    const row = document.createElement('div');
    row.className = 'builder-row';
    row.style.cssText = 'background: var(--bg-dark); padding: 15px; margin-bottom: 15px; border: 1px solid var(--border);';
    
    row.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" class="q-label" placeholder="Question / Field Name" style="flex: 2;">
            <select class="q-type" style="flex: 1;" onchange="toggleOptions(this)">
                <option value="text">Text Answer (Any length)</option>
                <option value="number">Number</option>
                <option value="multiple_choice">Multiple choice (Radio)</option>
                <option value="checkboxes">Checkboxes</option>
                <option value="dropdown">Dropdown</option>
                <option value="file_upload">Photo / File Upload</option>
                <option value="date">Date</option>
            </select>
            <label style="display: flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 0.8rem;">
                <input type="checkbox" class="q-req" checked> *Required
            </label>
            <button class="btn-secondary" onclick="this.parentElement.parentElement.remove()" style="color: #FF3B30; border-color: #FF3B30; padding: 5px 10px;">X</button>
        </div>
        
        <div class="dynamic-options-container" style="display: none; padding-left: 15px; border-left: 2px solid var(--border);">
            <div class="options-list"></div>
            <button type="button" class="btn-secondary" onclick="addDynamicOption(this)" style="margin-top: 8px; font-size: 0.75rem; padding: 5px 10px;">+ Add Option</button>
        </div>
    `;
    container.appendChild(row);
}

// Shows the "Options" input field if the question type needs it
// Shows the dynamic options container and adds the first option automatically
window.toggleOptions = function(selectElement) {
    const type = selectElement.value;
    const optionsContainer = selectElement.parentElement.parentElement.querySelector('.dynamic-options-container');
    const optionsList = optionsContainer.querySelector('.options-list');
    
    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(type)) {
        optionsContainer.style.display = 'block';
        if (optionsList.children.length === 0) addDynamicOption(optionsContainer.querySelector('button'));
    } else {
        optionsContainer.style.display = 'none';
        optionsList.innerHTML = ''; // Clear memory if they switch back to a text question
    }
}

// Injects new input rows for multiple choice/checkboxes
window.addDynamicOption = function(btnElement) {
    const list = btnElement.parentElement.querySelector('.options-list');
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 10px; margin-bottom: 5px; align-items: center;';
    div.innerHTML = `
        <span style="color: var(--text-muted);">○</span>
        <input type="text" class="dyn-opt-val" placeholder="Option..." required style="flex: 1; padding: 8px;">
        <button type="button" class="btn-secondary" onclick="this.parentElement.remove()" style="padding: 4px 8px; border: none; color: #FF3B30;">X</button>
    `;
    list.appendChild(div);
}

document.getElementById('save-form-btn').addEventListener('click', async () => {
    const targetMod = document.getElementById('form-target-module').value;
    if (!targetMod || targetMod.includes("Select")) return alert("Please select a module first.");
    
    const rows = document.querySelectorAll('.builder-row');
    const fields = [];
    
    rows.forEach(row => {
        // Inside save-form-btn event listener loop:
        const label = row.querySelector('.q-label').value.trim();
        const type = row.querySelector('.q-type').value;
        const required = row.querySelector('.q-req').checked;
        
        // NEW EXTRACTION LOGIC
        const optionsNodes = row.querySelectorAll('.dyn-opt-val');
        let optionsArray = [];
        if (['multiple_choice', 'checkboxes', 'dropdown'].includes(type) && optionsNodes.length > 0) {
            optionsNodes.forEach(opt => {
                if(opt.value.trim()) optionsArray.push(opt.value.trim());
            });
        }
        
        if (label) fields.push({ label, type, required, options: optionsArray });
    });
    
    if (fields.length === 0) return alert("Add at least one valid question.");
    const btn = document.getElementById('save-form-btn');
    btn.innerText = "Deploying Form...";
    
    await appendRowToSheet("Forms", [targetMod, JSON.stringify(fields), new Date().toLocaleDateString()]);
    btn.innerText = "Deploy to Inspectors";
    document.getElementById('form-fields-container').innerHTML = '';
    alert("✅ Form deployed!");
});

function renderReportTable() {
    const selectedModId = document.getElementById('report-module-select').value;
    const tbody = document.getElementById('report-table-body');
    const modNameDisplay = document.getElementById('report-mod-name');
    
    document.getElementById('report-date').innerText = new Date().toLocaleString();
    if (!selectedModId) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Select a module.</td></tr>';
        return;
    }
    modNameDisplay.innerText = selectedModId;
    tbody.innerHTML = '';

    const relevantLogs = allSubmissions.filter(row => row[0] === selectedModId);
    if (relevantLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center;">No logs submitted yet.</td></tr>`;
        return;
    }
    relevantLogs.forEach(log => {
        const tr = document.createElement('tr');
        
        // Convert any raw text URLs or base64 data into clickable download links
        let rawData = log[3] || '';
        let linkedData = rawData.replace(/(https?:\/\/[^\s]+|data:[^\s]+)/g, function(url) {
            return `<br><a href="${url}" target="_blank" download="Site_File" style="color: var(--accent); text-decoration: underline;">[View/Download File]</a><br>`;
        });
        const formattedData = linkedData.replace(/\|/g, '<br><br>');

        tr.innerHTML = `<td style="font-size: 0.8rem; color: var(--text-muted);">${log[1] || 'N/A'}</td>
            <td><strong style="color:var(--accent);">${log[2] || 'Inspector'}</strong></td>
            <td style="line-height: 1.4; font-size: 0.9rem;">${formattedData}</td>`;
        tbody.appendChild(tr);
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    if (tabId === 'reports') {
        document.getElementById('notif-badge').style.display = 'none';
        localStorage.setItem('hs_last_sub_count', allSubmissions.length);
    }
}

document.getElementById('new-module-btn').addEventListener('click', () => document.getElementById('modal-new-module').classList.remove('hidden'));
function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }
function copyEngineCode() {
    const code = document.getElementById('engine-script-code').innerText;
    navigator.clipboard.writeText(code);
    alert("✅ Engine Script Copied! Paste this into Google Apps Script.");
}
function showRefreshToast() { document.getElementById('sync-toast').classList.remove('hidden'); }
function generatePDF() {
    const element = document.getElementById('pdf-export-area');
    
    // 1. Force the element into dark-text mode for the screenshot
    element.classList.add('pdf-light-mode');
    
    const opt = {
        margin: 10,
        filename: 'HydroStack_Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' }, // Force white background
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // 2. Generate PDF, then instantly remove the class to restore the dark UI
    html2pdf().set(opt).from(element).save().then(() => {
        element.classList.remove('pdf-light-mode');
    });
}