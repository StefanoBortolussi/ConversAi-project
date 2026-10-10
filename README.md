# ConversAi-project

Applicazione web full-stack per la gestione di conversazioni testuali con un assistente simulato.
Progetto del corso di Applicazioni Web, A.A. 2025/2026, Università degli Studi di Udine.

**Autore:** Stefano Bortolussi 

## Descrizione

I dati sono organizzati su tre livelli: un **progetto** contiene più **conversazioni**, ciascuna dedicata a un topic, e ogni conversazione contiene una sequenza di **messaggi** (dell'utente o dell'assistente). L'interfaccia ha una sidebar con progetti e conversazioni e un'area principale con la chat. I messaggi vengono inviati al server con la Fetch API e salvati in SQLite, e la risposta dell'assistente viene generata lato server da una funzione di simulazione. La pagina non viene mai ricaricata.

Funzionalità aggiuntive implementate: **ricerca nello storico (4.5)** ed **esportazione di una conversazione in JSON (4.7)**.

## Tecnologie

- Front-end: HTML, CSS, JavaScript
- Back-end: Node.js ed Express.js
- Database: SQLite (modulo `sqlite3`)

## Requisiti

Node.js e npm installati sul computer.

## Struttura del progetto

```
conversai/
├── server.js          # server Express, endpoint REST, funzione di simulazione
├── db.js              # connessione SQLite e creazione delle tabelle
├── package.json       # dipendenze e script di avvio
├── package-lock.json
├── README.md
├── data/              # creata automaticamente al primo avvio
│   └── database.sqlite
└── public/            # file statici serviti da Express
    ├── index.html
    ├── style.css
    └── app.js
```

## Installazione e avvio

Dalla cartella del progetto:

```
npm install     # installa le dipendenze (express, sqlite3)
npm start       # avvia il server (node server.js)
```

L'applicazione è raggiungibile sul link: <http://localhost:3000>

La porta si può cambiare con la variabile d'ambiente `PORT`:

```
PORT = 4000 npm start         
```

## Inizializzazione del database

Non è necessario alcuno script. Al primo avvio `db.js` crea la cartella `data/`, il file `database.sqlite` e le tre tabelle (`projects`, `conversations`, `messages`) con `CREATE TABLE IF NOT EXISTS`. Agli avvii successivi i dati esistenti vengono riutilizzati.

Per ripartire da un database vuoto: fermare il server, cancellare `data/database.sqlite` e riavviare con `npm start`.

## Uso dell'interfaccia

1. **+ Nuovo Progetto** crea un progetto (viene chiesto il nome).
2. Un clic su un progetto mostra le sue conversazioni; **+ Nuova Conversazione** chiede il topic.
3. Selezionando una conversazione si caricano i messaggi; se è vuota, l'assistente invia un messaggio di benvenuto.
4. Il form in basso invia il prompt: compaiono il messaggio dell'utente (a destra) e la risposta dell'assistente (a sinistra).
5. **Esporta JSON** scarica la conversazione, **Elimina** la cancella. La × accanto a un progetto elimina il progetto con tutte le sue conversazioni.
6. La barra di ricerca nella sidebar cerca in topic, nomi dei progetti e contenuto dei messaggi; un clic su un risultato apre la conversazione.

## API REST

Tutte le risposte, anche di errore, sono in JSON (`{ "error": "..." }`).

| Metodo | Path | Dati ricevuti | Risposta | Errori |
|---|---|---|---|---|
| GET | `/api/projects` | – | 200, array di progetti | 500 |
| POST | `/api/projects` | body `{name, description}` | 201, progetto creato | 400 nome vuoto o non testuale, descrizione non testuale; 500 |
| DELETE | `/api/projects/:id` | id nel path | 200, `{message, id}` | 404; 500 |
| GET | `/api/projects/:projectId/conversations` | projectId nel path | 200, array di conversazioni | 404 progetto assente; 500 |
| POST | `/api/projects/:projectId/conversations` | body `{topic}` | 201, conversazione creata | 400 topic vuoto; 404 progetto assente; 500 |
| DELETE | `/api/conversations/:id` | id nel path | 200, `{message, id}` | 404; 500 |
| GET | `/api/conversations/:id/messages` | id nel path | 200, array di messaggi | 404 conversazione assente; 500 |
| POST | `/api/conversations/:id/messages` | body `{content}` | 201, `{userMessage, assistantMessage}` | 400 testo vuoto; 404 conversazione assente; 500 |
| GET | `/api/search?q=` | query string `q` | 200, array di risultati | 500 |
| GET | `/api/conversations/:id/export` | id nel path | 200, oggetto JSON | 404; 500 |

Un percorso `/api/...` sconosciuto risponde 404 e un corpo con JSON malformato risponde 400, sempre in JSON.

### Esempio: invio di un messaggio

```bash
curl -X POST http://localhost:3000/api/conversations/1/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "ciao"}'
```

```json
{
  "userMessage":      { "id": 2, "conversation_id": 1, "role": "user", "content": "ciao", "created_at": "..." },
  "assistantMessage": { "id": 3, "conversation_id": 1, "role": "assistant", "content": "Ciao! Sono il tuo assistente per il topic ...", "created_at": "..." }
}
```

## Simulazione delle risposte

La funzione `generateAssistantResponse(userPrompt, conversationTopic)` in `server.js` confronta il prompt (in minuscolo) con alcune parole chiave, nell'ordine:

| Il prompt contiene | Risposta |
|---|---|
| `ciao`, `salve` | saluto che cita il topic |
| `spiega`, `cosa` | breve spiegazione che cita prompt e topic |
| `grazie` | formula di cortesia che cita il topic |
| altro | conferma di elaborazione che cita prompt e topic |
