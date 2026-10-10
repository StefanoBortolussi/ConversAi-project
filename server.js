const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function generateAssistantResponse(userPrompt, conversationTopic) {
    const promptLower = userPrompt.toLowerCase();
    
    if (promptLower.includes('ciao') || promptLower.includes('salve')) {
        return `Ciao! Sono il tuo assistente per il topic "${conversationTopic}". Come posso aiutarti oggi?`;
    } else if (promptLower.includes('spiega') || promptLower.includes('cosa')) {
        return `Riguardo a "${userPrompt}", ecco una spiegazione sintetica contestualizzata nell'ambito di "${conversationTopic}": si tratta di un concetto chiave che richiede l'analisi dei suoi elementi fondamentali.`;
    } else if (promptLower.includes('grazie')) {
        return `Prego, Sono sempre a disposizione!!! Se hai altre domande su "${conversationTopic}", puoi farmele pure`;
    } else {
        return `Ho ricevuto la tua richiesta su "${userPrompt}" e la sto elaborando. Rispetto al topic "${conversationTopic}", posso confermarti che la procedura corretta richiede di considerare i vincoli di progetto e le specifiche operative.`;
    }
}

app.get('/api/projects', (req, res) => {
    const sql = `SELECT * FROM projects ORDER BY updated_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Errore durante il recupero dei progetti' });
        res.json(rows);
    });
});

app.post('/api/projects', (req, res) => {
    const { name, description } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'You must insert project name.' });
    }

    const sql = `INSERT INTO projects (name, description) VALUES (?, ?)`;
    db.run(sql, [name.trim(), description ? description.trim() : ''], function (err) {
        if (err) return res.status(500).json({ error: 'Error while executing the request' });
        res.status(201).json({
            id: this.lastID,
            name: name.trim(),
            description: description ? description.trim() : '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    });
});

app.delete('/api/projects/:id', (req, res) => {
    const projectId = req.params.id;
    const sql = `DELETE FROM projects WHERE id = ?`;
    
    db.run(sql, [projectId], function (err) {
        if (err) return res.status(500).json({ error: 'Errore durante l\'eliminazione del progetto' });
        if (this.changes === 0) return res.status(404).json({ error: 'Progetto non trovato' });
        res.json({ message: 'Progetto eliminato con successo', id: Number(projectId) });
    });
});

app.get('/api/projects/:projectId/conversations', (req, res) => {
    const { projectId } = req.params;
    const sql = `SELECT * FROM conversations WHERE project_id = ? ORDER BY updated_at DESC`;

    db.all(sql, [projectId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Errore durante il recupero delle conversazioni' });
        res.json(rows);
    });
});

app.post('/api/projects/:projectId/conversations', (req, res) => {
    const { projectId } = req.params;
    const { topic } = req.body;

    if (!topic || topic.trim() === '') {
        return res.status(400).json({ error: 'Il topic della conversazione è obbligatorio.' });
    }

    db.get(`SELECT id FROM projects WHERE id = ?`, [projectId], (err, project) => {
        if (err) return res.status(500).json({ error: 'Errore di sistema' });
        if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

        const sql = `INSERT INTO conversations (project_id, topic) VALUES (?, ?)`;
        db.run(sql, [projectId, topic.trim()], function (err) {
            if (err) return res.status(500).json({ error: 'Errore durante la creazione della conversazione' });
            res.status(201).json({
                id: this.lastID,
                project_id: Number(projectId),
                topic: topic.trim(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        });
    });
});

app.delete('/api/conversations/:id', (req, res) => {
    const conversationId = req.params.id;
    const sql = `DELETE FROM conversations WHERE id = ?`;

    db.run(sql, [conversationId], function (err) {
        if (err) return res.status(500).json({ error: 'Errore durante l\'eliminazione della conversazione' });
        if (this.changes === 0) return res.status(404).json({ error: 'Conversazione non trovata' });
        res.json({ message: 'Conversazione eliminata con successo', id: Number(conversationId) });
    });
});

app.get('/api/conversations/:id/messages', (req, res) => {
    const conversationId = req.params.id;
    const sql = `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`;

    db.all(sql, [conversationId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Errore durante il recupero dei messaggi' });

        if (rows.length === 0) {
            db.get(`SELECT * FROM conversations WHERE id = ?`, [conversationId], (errConv, conv) => {
                if (errConv || !conv) return res.json([]);

                const welcomeText = `Ciao! Sono il tuo assistente per il topic "${conv.topic}". Come posso aiutarti oggi?`;
                const sqlInsert = `INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)`;
                db.run(sqlInsert, [conversationId, welcomeText], function (errIns) {
                    if (errIns) return res.json([]);

                    const newMsg = {
                        id: this.lastID,
                        conversation_id: Number(conversationId),
                        role: 'assistant',
                        content: welcomeText,
                        created_at: new Date().toISOString()
                    };
                    res.json([newMsg]);
                });
            });
        } else {
            res.json(rows);
        }
    });
});

app.post('/api/conversations/:id/messages', (req, res) => {
    const conversationId = req.params.id;
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Il contenuto del messaggio non può essere vuoto.' });
    }

    db.get(`SELECT * FROM conversations WHERE id = ?`, [conversationId], (err, conv) => {
        if (err) return res.status(500).json({ error: 'Errore durante la verifica della conversazione' });
        if (!conv) return res.status(404).json({ error: 'Conversazione non trovata' });

        const userText = content.trim();
        const assistantText = generateAssistantResponse(userText, conv.topic);

        const sqlInsertUser = `INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)`;
        db.run(sqlInsertUser, [conversationId, userText], function (errUser) {
            if (errUser) return res.status(500).json({ error: 'Errore salvataggio messaggio utente' });

            const userMsg = {
                id: this.lastID,
                conversation_id: Number(conversationId),
                role: 'user',
                content: userText,
                created_at: new Date().toISOString()
            };

            const sqlInsertAssistant = `INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)`;
            db.run(sqlInsertAssistant, [conversationId, assistantText], function (errAssistant) {
                if (errAssistant) return res.status(500).json({ error: 'Errore salvataggio messaggio assistente' });

                const assistantMsg = {
                    id: this.lastID,
                    conversation_id: Number(conversationId),
                    role: 'assistant',
                    content: assistantText,
                    created_at: new Date().toISOString()
                };

                db.run(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [conversationId]);

                res.status(201).json({ userMessage: userMsg, assistantMessage: assistantMsg });
            });
        });
    });
});

app.get('/api/search', (req, res) => {
    const query = req.query.q;
    if (!query || query.trim() === '') {
        return res.json([]);
    }

    const searchTerm = `%${query.trim()}%`;
    const sql = `
        SELECT c.id AS conversation_id, c.topic,
               p.id AS project_id, p.name AS project_name,
               m.id AS message_id, m.content, m.role, m.created_at
        FROM conversations c
        JOIN projects p ON c.project_id = p.id
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE c.topic LIKE ? OR p.name LIKE ? OR m.content LIKE ?
        ORDER BY c.created_at DESC, m.created_at DESC
    `;

    db.all(sql, [searchTerm, searchTerm, searchTerm], (err, rows) => {
        if (err) {
            console.error('Errore durante la ricerca:', err.message);
            return res.status(500).json({ error: 'Errore durante la ricerca nello storico' });
        }
        res.json(rows);
    });
});

app.get('/api/conversations/:id/export', (req, res) => {
    const conversationId = req.params.id;

    const sqlConv = `
        SELECT c.id, c.topic, c.created_at, p.name AS project_name
        FROM conversations c
        JOIN projects p ON c.project_id = p.id
        WHERE c.id = ?
    `;

    db.get(sqlConv, [conversationId], (err, conv) => {
        if (err) return res.status(500).json({ error: 'Errore durante il recupero della conversazione' });
        if (!conv) return res.status(404).json({ error: 'Conversazione non trovata' });

        const sqlMsgs = `SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`;
        db.all(sqlMsgs, [conversationId], (errMsgs, messages) => {
            if (errMsgs) return res.status(500).json({ error: 'Errore durante il recupero dei messaggi' });

            const exportData = {
                project: conv.project_name,
                topic: conv.topic,
                exported_at: new Date().toISOString(),
                total_messages: messages.length,
                messages: messages
            };

            res.json(exportData);
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server avviato con successo ed in ascolto sulla porta ${PORT}`);
});