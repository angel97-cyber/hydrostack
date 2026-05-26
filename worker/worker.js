// --- CONFIGURATION ---
// No Google Client IDs or Scopes needed anymore!
let moduleData = null; 
let activeFormLayout = []; 

// URL INTERCEPTOR (MAGIC LINK AUTO-LOGIN)
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const moduleParam = urlParams.get('module');
    
    if (moduleParam) {
        document.getElementById('smart-key-input').value = moduleParam;
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

window.onload = function () {
    const savedName = localStorage.getItem('hs_inspector_name');
    if (savedName) {
        document.getElementById('inspector-name').value = savedName;
        document.getElementById('display-inspector-name').innerText = savedName;
        document.getElementById('identity-section').style.display = 'none'; 
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
    updateQueueUI();
};

document.getElementById('auth-btn').addEventListener('click', () => {
    const keyInput = document.getElementById('smart-key-input').value.trim();
    const pinInput = document.getElementById('pin-input').value.trim();
    const nameInput = document.getElementById('inspector-name').value.trim();
    const errorMsg = document.getElementById('login-error');

    if (!nameInput) {
        errorMsg.innerText = "Please enter your Full Name.";
        errorMsg.style.display = 'block'; return;
    }

    try {
        const decoded = JSON.parse(atob(keyInput));
        if (decoded.pin !== pinInput) {
            errorMsg.innerText = "Invalid Passcode."; errorMsg.style.display = 'block'; return;
        }
        
        // Save identity!
        localStorage.setItem('hs_inspector_name', nameInput);
        document.getElementById('display-inspector-name').innerText = nameInput;

        // SAVE MODULE TO HOMEPAGE LIST
        let savedModules = JSON.parse(localStorage.getItem('hydrostack_modules')) || [];
        if (!savedModules.some(m => m.proj === decoded.proj)) {
            savedModules.push(decoded);
            localStorage.setItem('hydrostack_modules', JSON.stringify(savedModules));
        }

        moduleData = decoded;
        // Replaces tokenClient.requestAccessToken()
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('homepage-screen').classList.add('active'); 
        renderWorkerHomepage();
        syncPendingLogs();

    } catch (e) {
        errorMsg.innerText = "Invalid Access Link."; errorMsg.style.display = 'block';
    }
});

async function fetchModuleForm() {
    if (!navigator.onLine) {
        const cachedForm = localStorage.getItem(`form_${moduleData.proj}`);
        if (cachedForm) { activeFormLayout = JSON.parse(cachedForm); renderFormUI(); } 
        else { document.getElementById('dynamic-form-container').innerHTML = `<p style="color: var(--error);">Offline: Form not downloaded yet.</p>`; }
        return;
    }

    try {
        document.getElementById('module-title-display').innerText = `Module: ${moduleData.proj}`;
        // INSIDE fetchModuleForm() ... Replace the googleapis fetch with this:
        const res = await fetch(moduleData.engine, {
            method: 'POST',
            body: JSON.stringify({ action: 'get', sheetId: moduleData.db, tabName: 'Forms' })
        });
        const data = await res.json();
        const rows = data.values || [];
        
        let targetFormJSON = null;
        for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i][0] === moduleData.proj) { targetFormJSON = rows[i][1]; break; }
        }

        if (!targetFormJSON) { document.getElementById('dynamic-form-container').innerHTML = `<p>No custom form found.</p>`; return; }

        activeFormLayout = JSON.parse(targetFormJSON);
        localStorage.setItem(`form_${moduleData.proj}`, targetFormJSON);
        renderFormUI();
    } catch (error) { console.error("Failed:", error); }
}

function renderFormUI() {
    const container = document.getElementById('dynamic-form-container');
    container.innerHTML = ''; 

    activeFormLayout.forEach((field, index) => {
        const reqHTML = field.required ? '<span class="required-star">*</span>' : '';
        const safeId = `field_${index}`;
        let inputHTML = '';
        
        switch (field.type) {
            // REPLACE short_answer and paragraph WITH THIS:
            case 'text':
                inputHTML = `<textarea id="${safeId}" rows="3" placeholder="Type answer here..."></textarea>`; 
                break;
            // (Leave the rest of your cases like 'number', 'date', etc. untouched)
            case 'number':
                inputHTML = `<input type="number" id="${safeId}" placeholder="0">`; break;
            case 'date':
                inputHTML = `<input type="date" id="${safeId}">`; break;
            
            // THE NEW COMPLEX FIELDS
            case 'dropdown':
                let optionsHTML = field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
                inputHTML = `<select id="${safeId}"><option value="">Select an option...</option>${optionsHTML}</select>`;
                break;
            case 'multiple_choice':
                inputHTML = field.options.map((opt, i) => `
                    <div class="check-row">
                        <input type="radio" name="${safeId}" id="${safeId}_${i}" value="${opt}">
                        <label for="${safeId}_${i}" style="margin:0; text-transform:none; color:var(--text-main);">${opt}</label>
                    </div>`).join('');
                break;
            case 'checkboxes':
                inputHTML = field.options.map((opt, i) => `
                    <div class="check-row">
                        <input type="checkbox" class="chk_${safeId}" id="${safeId}_${i}" value="${opt}">
                        <label for="${safeId}_${i}" style="margin:0; text-transform:none; color:var(--text-main);">${opt}</label>
                    </div>`).join('');
                break;
            case 'file_upload':
                // ADDED the "multiple" attribute here
                inputHTML = `<input type="file" id="${safeId}" accept="image/*, .pdf" multiple> <p style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">File will be logged on device.</p>`;
                break;
                
            default:
                inputHTML = `<input type="text" id="${safeId}" placeholder="...">`;
        }

        const groupDiv = document.createElement('div');
        groupDiv.className = 'input-group';
        groupDiv.innerHTML = `<label>${field.label} ${reqHTML}</label> ${inputHTML}`;
        container.appendChild(groupDiv);
    });

    document.getElementById('submit-log-btn').style.display = 'block';
}


// Helper to convert files to Base64
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

document.getElementById('submit-log-btn').addEventListener('click', async () => {
    let isValid = true;
    const formDataObj = {};
    const btn = document.getElementById('submit-log-btn');
    btn.innerText = "Processing..."; btn.disabled = true;

    for (let i = 0; i < activeFormLayout.length; i++) {
        const field = activeFormLayout[i];
        const safeId = `field_${i}`;
        let value = '';

        if (field.type === 'multiple_choice') {
            const checked = document.querySelector(`input[name="${safeId}"]:checked`);
            value = checked ? checked.value : '';
        } else if (field.type === 'checkboxes') {
            const checked = Array.from(document.querySelectorAll(`.chk_${safeId}:checked`));
            value = checked.map(cb => cb.value).join(', ');
        } else if (field.type === 'file_upload') {
            const fileInput = document.getElementById(safeId);
            if (fileInput.files.length > 0) {
                let fileUrls = [];
                for(let file of fileInput.files) {
                    let base64 = await toBase64(file);
                    // Flag it. If online, syncPendingLogs will immediately upload it to Google Drive.
                    fileUrls.push(`[PENDING_UPLOAD]${file.name}|${file.type}|${base64}`); 
                }
                value = fileUrls.join(' , ');
            } else {
                value = 'No files attached';
            }
        } else {
            value = document.getElementById(safeId).value.trim();
        }

        if (field.required && !value && field.type !== 'file_upload') isValid = false;
        formDataObj[field.label] = value;
    }

    if (!isValid) {
        btn.innerText = "Save & Sync Log"; btn.disabled = false;
        return alert("Please fill out all required fields.");
    }

    const readableString = Object.entries(formDataObj).map(([key, val]) => `${key}: ${val}`).join('  |  ');
    const inspectorName = localStorage.getItem('hs_inspector_name') || "Unknown Inspector";

    const logEntry = {
        projectId: moduleData.proj, timestamp: new Date().toLocaleString(),
        workerEmail: inspectorName, dataString: readableString
    };

    let queue = JSON.parse(localStorage.getItem('hydrostack_queue')) || [];
    queue.push(logEntry);
    localStorage.setItem('hydrostack_queue', JSON.stringify(queue));

    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('success-screen').classList.add('active');
    
    btn.innerText = "Save & Sync Log"; btn.disabled = false;
    updateQueueUI();
    syncPendingLogs();
});

async function syncPendingLogs() {
    if (!navigator.onLine || !moduleData) return;
    let queue = JSON.parse(localStorage.getItem('hydrostack_queue')) || [];
    if (queue.length === 0) return;

    const btn = document.getElementById('force-sync-btn');
    btn.innerText = "Syncing to Cloud...";

    try {
        // 1. Process File Uploads via Apps Script
        for (let j = 0; j < queue.length; j++) {
            if (queue[j].dataString.includes('[PENDING_UPLOAD]')) {
                let parts = queue[j].dataString.split('  |  ');
                for (let k = 0; k < parts.length; k++) {
                    if (parts[k].includes('[PENDING_UPLOAD]')) {
                        let fieldLabel = parts[k].split(': ')[0];
                        let filesRaw = parts[k].split(': ')[1].split(' , ');
                        let cleanUrls = [];
                        
                        for (let rawStr of filesRaw) {
                            if (rawStr.startsWith('[PENDING_UPLOAD]')) {
                                let fileData = rawStr.replace('[PENDING_UPLOAD]', '').split('|');
                                let res = await fetch(moduleData.engine, { // Using the Engine URL
                                    method: 'POST',
                                    body: JSON.stringify({ action: 'upload', filename: fileData[0], mimeType: fileData[1], base64: fileData[2].split(',')[1] })
                                });
                                let data = await res.json();
                                cleanUrls.push(data.url || "Upload Failed");
                            } else {
                                cleanUrls.push(rawStr);
                            }
                        }
                        parts[k] = `${fieldLabel}: ${cleanUrls.join(' , ')}`;
                    }
                }
                queue[j].dataString = parts.join('  |  ');
            }
        }

        // 2. Process Data Rows via Apps Script
        const values = queue.map(log => [log.projectId, log.timestamp, log.workerEmail, log.dataString]);
        
        const response = await fetch(moduleData.engine, {
            method: 'POST', 
            body: JSON.stringify({ action: 'append', sheetId: moduleData.db, tabName: 'Submissions', values: values })
        });
        
        const resData = await response.json();

        if (resData.success) {
            localStorage.setItem('hydrostack_queue', JSON.stringify([]));
            btn.innerText = "Sync Complete ✅";
            setTimeout(() => { btn.innerText = "Force Sync Now"; }, 2000);
            updateQueueUI();
        } else { throw new Error("API rejected."); }
    } catch (error) { btn.innerText = "Sync Failed - Retry later"; }
}

function updateNetworkStatus() {
    const statusDiv = document.getElementById('network-status');
    if (navigator.onLine) {
        statusDiv.innerHTML = '<span class="dot green"></span> Online';
        syncPendingLogs();
    } else {
        statusDiv.innerHTML = '<span class="dot red"></span> Offline';
    }
}

function updateQueueUI() {
    const queue = JSON.parse(localStorage.getItem('hydrostack_queue')) || [];
    document.getElementById('pending-count').innerText = queue.length;
}

document.getElementById('force-sync-btn').addEventListener('click', syncPendingLogs);

// THE HOMEPAGE RENDERER
function renderWorkerHomepage() {
    const savedModules = JSON.parse(localStorage.getItem('hydrostack_modules')) || [];
    const listContainer = document.getElementById('worker-module-list');
    
    if (savedModules.length === 0) {
        listContainer.innerHTML = '<p style="color: var(--text-muted);">No modules assigned yet. Ask your Manager for a Magic Link.</p>';
        return;
    }
    
    listContainer.innerHTML = ''; 
    
    savedModules.forEach(mod => {
        const card = document.createElement('div');
        card.style.cssText = 'background: var(--surface); padding: 20px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;';
        
        // Use the extra details we packed into the Magic Link
        const displayTitle = mod.name ? `${mod.proj} - ${mod.name}` : mod.proj;
        const displayDesc = mod.loc ? `📍 ${mod.loc}` : 'Saved Offline';
        
        // Brute force "New" badge for visual pop
        card.innerHTML = `
            <div>
                <h3 style="color: var(--accent); margin-bottom: 5px;">${displayTitle} <span class="badge" style="background:var(--error); margin-left:5px;">New</span></h3>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${displayDesc}</span>
            </div>
            <div style="font-size: 1.2rem;">➔</div>
        `;
        
        card.addEventListener('click', async () => {
            moduleData = mod; 
            document.getElementById('module-title-display').innerText = displayTitle; // Updates top of form screen
            document.getElementById('homepage-screen').classList.remove('active');
            document.getElementById('app-screen').classList.add('active'); 
            await fetchModuleForm();
        });
        
        listContainer.appendChild(card);
    });
}