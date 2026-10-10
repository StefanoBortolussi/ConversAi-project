document.addEventListener('DOMContentLoaded', () => {
    const state = {
        projects: [],
        selectedProjectId: null,
        selectedProjectName: '',
        selectedConversationId: null,
        selectedTopic: ''
    };

    const projectsContainer = document.getElementById('projects-container');
    const btnNewProject = document.getElementById('btn-new-project');

    const searchInput = document.getElementById('search-input');
    const btnSearch = document.getElementById('btn-search');
    const searchModal = document.getElementById('search-modal');
    const searchResultsContainer = document.getElementById('search-results-container');
    const btnCloseSearch = document.getElementById('btn-close-search');

    const headerTitle = document.getElementById('current-topic');
    const headerSubtitle = document.getElementById('current-project-name');

    const btnExport = document.getElementById('btn-export-chat');
    const btnDeleteConv = document.getElementById('btn-delete-conv');

    const messagesContainer = document.getElementById('messages-container');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('user-input');
    const btnSend = document.getElementById('btn-send');

    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    let isSidebarOpen = true;

    init();

    function init() {
        loadProjects();
        setupEventListeners();
        updateUIState();
    }

    function setupEventListeners() {
        btnNewProject.addEventListener('click', handleCreateProject);

        btnSearch.addEventListener('click', handleSearch);
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
        btnCloseSearch.addEventListener('click', closeSearchModal);
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) closeSearchModal();
        });

        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSendMessage();
        });

        btnExport.addEventListener('click', handleExportJSON);
        btnDeleteConv.addEventListener('click', handleDeleteConversation);

        btnToggleSidebar.addEventListener('click', toggleSidebar);
    }

    function toggleSidebar() {
        isSidebarOpen = !isSidebarOpen;
        document.documentElement.style.setProperty('--sidebar-width', isSidebarOpen ? '280px' : '0px');
        btnToggleSidebar.textContent = isSidebarOpen ? '◂' : '▸';
        btnToggleSidebar.classList.toggle('collapsed', !isSidebarOpen);
        btnToggleSidebar.setAttribute('aria-expanded', String(isSidebarOpen));
    }

    async function loadProjects() {
        try {
            const res = await fetch('/api/projects');
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore nel caricamento dei progetti.');
            }
            state.projects = await res.json();
            await renderSidebar(); 
        } catch (err) {
            console.error(err);
            alert(`Impossibile caricare i progetti: ${err.message}`);
        }
    }

    async function handleCreateProject() {
        const name = prompt('Inserisci il nome del nuovo progetto:');
        
        if (name === null) return;

        if (name.trim() === '') {
            alert('Errore: non puoi creare un progetto senza nome.');
            return;
        }

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), description: '' })
            });
            if (res.ok) {
                await loadProjects();
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore durante la creazione del progetto.');
            }
        } catch (err) {
            console.error(err);
            alert(`Impossibile creare il progetto: ${err.message}`);
        }
    }

    async function handleDeleteProject(projectId, event) {
        event.stopPropagation();
        if (!confirm('Sei sicuro di voler eliminare questo progetto e tutte le sue conversazioni?')) return;

        try {
            const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
            if (res.ok) {
                if (state.selectedProjectId === projectId) resetSelection();
                await loadProjects();
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore durante l\'eliminazione del progetto.');
            }
        } catch (err) {
            console.error(err);
            alert(`Impossibile eliminare il progetto: ${err.message}`);
        }
    }

    async function loadConversationsForProject(projectId) {
        try {
            const res = await fetch(`/api/projects/${projectId}/conversations`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore caricamento conversazioni.');
            }
            return await res.json();
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    async function handleCreateConversation(projectId) {
        const topic = prompt('Inserisci l\'argomento (topic) della conversazione:');
        
        if (topic === null) return;
        
        if (topic.trim() === '') {
            alert('Errore: non puoi creare una conversazione senza argomento.');
            return;
        }

        try {
            const res = await fetch(`/api/projects/${projectId}/conversations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic.trim() })
            });

            if (res.ok) {
                const newConv = await res.json();
                await loadProjects();
                selectConversation(newConv.id, newConv.topic, projectId, state.selectedProjectName);
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore durante la creazione della conversazione.');
            }
        } catch (err) {
            console.error(err);
            alert(`Impossibile creare la conversazione: ${err.message}`);
        }
    }

    async function handleDeleteConversation() {
        if (!state.selectedConversationId) return;
        if (!confirm('Sei sicuro di voler eliminare questa conversazione?')) return;

        try {
            const res = await fetch(`/api/conversations/${state.selectedConversationId}`, { method: 'DELETE' });
            if (res.ok) {
                resetSelection();
                await loadProjects();
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore durante l\'eliminazione della conversazione.');
            }
        } catch (err) {
            console.error(err);
            alert(`Impossibile eliminare la conversazione: ${err.message}`);
        }
    }

    async function selectConversation(convId, topic, projectId, projectName) {
        state.selectedConversationId = Number(convId);
        state.selectedTopic = topic;
        state.selectedProjectId = Number(projectId);
        state.selectedProjectName = projectName;

        updateUIState();
        await loadMessages(convId);
    }

    async function loadMessages(convId) {
        try {
            const res = await fetch(`/api/conversations/${convId}/messages`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore caricamento messaggi.');
            }
            const messages = await res.json();
            renderMessages(messages);
        } catch (err) {
            console.error(err);
            alert(`Impossibile caricare la cronologia della chat: ${err.message}`);
        }
    }

    async function handleSendMessage() {
        if (!state.selectedConversationId) return;

        const content = messageInput.value.trim();
        if (!content) return;

        messageInput.disabled = true;
        btnSend.disabled = true;

        try {
            const res = await fetch(`/api/conversations/${state.selectedConversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            if (res.ok) {
                const data = await res.json();
                appendMessage(data.userMessage);
                appendMessage(data.assistantMessage);
                scrollToBottom();
                
                messageInput.value = '';
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore sconosciuto durante l\'invio.');
            }
        } catch (err) {
            console.error(err);
            alert(`Impossibile inviare il messaggio: ${err.message}`);
        } finally {
            messageInput.disabled = false;
            btnSend.disabled = false;
            messageInput.focus();
        }
    }

    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore durante la ricerca.');
            }
            const results = await res.json();
            renderSearchResults(results);
            openSearchModal();
        } catch (err) {
            console.error(err);
            alert(`Impossibile completare la ricerca: ${err.message}`);
        }
    }

    function openSearchModal() {
        searchModal.classList.remove('hidden');
    }

    function closeSearchModal() {
        searchModal.classList.add('hidden');
    }

    async function handleExportJSON() {
        if (!state.selectedConversationId) return;

        try {
            const res = await fetch(`/api/conversations/${state.selectedConversationId}/export`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Errore durante l\'esportazione.');
            }
            const data = await res.json();

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `conversazione_${state.selectedConversationId}_${state.selectedTopic.replace(/\s+/g, '_')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert(`Impossibile esportare la conversazione: ${err.message}`);
        }
    }

    async function renderSidebar() {
        if (state.projects.length === 0) {
            projectsContainer.innerHTML = '<div class="empty-list">Nessun progetto disponibile</div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        for (const project of state.projects) {
            const conversations = await loadConversationsForProject(project.id);

            const projectDiv = document.createElement('div');
            projectDiv.className = `project-item ${state.selectedProjectId === project.id ? 'open' : ''}`;

            projectDiv.innerHTML = `
                <div class="project-header">
                    <span class="project-title">📁 ${escapeHtml(project.name)}</span>
                    <span class="btn-delete-project" title="Elimina Progetto">&times;</span>
                </div>
                <div class="conversations-list">
                    ${conversations.map(conv => `
                        <div class="conv-item ${state.selectedConversationId === conv.id ? 'selected' : ''}"
                             data-conv-id="${conv.id}">
                            💬 ${escapeHtml(conv.topic)}
                        </div>
                    `).join('')}
                    <div class="btn-new-conv">+ Nuova Conversazione</div>
                </div>
            `;

            projectDiv.querySelector('.project-header').addEventListener('click', () => {
                projectDiv.classList.toggle('open');
            });

            projectDiv.querySelector('.btn-delete-project').addEventListener('click', (e) => handleDeleteProject(project.id, e));

            projectDiv.querySelectorAll('.conv-item').forEach((item, index) => {
                const conv = conversations[index];
                item.addEventListener('click', () => selectConversation(conv.id, conv.topic, project.id, project.name));
            });

            projectDiv.querySelector('.btn-new-conv').addEventListener('click', () => {
                state.selectedProjectId = project.id;
                state.selectedProjectName = project.name;
                handleCreateConversation(project.id);
            });

            fragment.appendChild(projectDiv);
        }

        projectsContainer.innerHTML = '';
        projectsContainer.appendChild(fragment);
    }

    function renderSearchResults(results) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<div class="empty-list">Nessun risultato trovato.</div>';
            return;
        }

        searchResultsContainer.innerHTML = '';
        results.forEach(res => {
            const item = document.createElement('div');
            item.className = 'search-result-item';

            const snippetHtml = res.content
                ? `<strong>${escapeHtml(res.role)}:</strong> ${escapeHtml(res.content)}`
                : `<em>Nessun messaggio in questa conversazione</em>`;

            item.innerHTML = `
                <div class="search-header">💬 ${escapeHtml(res.topic)} <small>(${escapeHtml(res.project_name)})</small></div>
                <div class="search-snippet">${snippetHtml}</div>
            `;
            item.addEventListener('click', () => {
                selectConversation(res.conversation_id, res.topic, res.project_id, res.project_name);
                closeSearchModal();
            });
            searchResultsContainer.appendChild(item);
        });
    }

    function renderMessages(messages) {
        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div class="empty-state"><p>Inizia la conversazione scrivendo un messaggio qui sotto.</p></div>';
            return;
        }

        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    }

    function appendMessage(msg) {
        const placeholder = messagesContainer.querySelector('.empty-state');
        if (placeholder) placeholder.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `message-bubble ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`;
        msgDiv.innerHTML = `
            <div class="message-content">${escapeHtml(msg.content)}</div>
            <div class="message-time">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;

        messagesContainer.appendChild(msgDiv);
    }

    function updateUIState() {
        const isConvSelected = state.selectedConversationId !== null;

        btnExport.disabled = !isConvSelected;
        btnDeleteConv.disabled = !isConvSelected;
        btnSend.disabled = !isConvSelected;

        messageInput.disabled = !isConvSelected;
        messageInput.placeholder = isConvSelected ? 'Scrivi un messaggio...' : 'Seleziona una conversazione per iniziare...';
        if (isConvSelected) messageInput.focus();

        headerTitle.textContent = isConvSelected ? state.selectedTopic : 'Seleziona una conversazione';
        headerSubtitle.textContent = isConvSelected ? `Progetto: ${state.selectedProjectName}` : 'Nessun progetto selezionato';

        if (!isConvSelected) {
            messagesContainer.innerHTML = '<div class="empty-state"><p>Seleziona o crea un nuovo progetto e una conversazione per iniziare a chattare con ConversAI.</p></div>';
        }
    }

    function resetSelection() {
        state.selectedProjectId = null;
        state.selectedProjectName = '';
        state.selectedConversationId = null;
        state.selectedTopic = '';
        updateUIState();
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function escapeHtml(str) {
        return str ? String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : '';
    }
});