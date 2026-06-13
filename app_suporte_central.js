

const helpModal = document.getElementById('helpModal');
const helpModalTitle = document.getElementById('helpModalTitle');
const helpModalBody = document.getElementById('helpModalBody');
const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
const btnCloseHelpModal2 = document.getElementById('btnCloseHelpModal2');

function closeHelp() {
    if (helpModal) helpModal.classList.add('hidden');
}

function openHelp(title, html) {
    if (!helpModal || !helpModalBody) return;
    if (helpModalTitle) helpModalTitle.textContent = title || 'Ajuda';
    helpModalBody.innerHTML = html || '';
    helpModal.classList.remove('hidden');
}